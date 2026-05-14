/*
 *      _           _      _
 *  ___| |__  _   _| |_ __| | _____      ___ __        _ __ ___   __ _ _ __   __ _  __ _  ___ _ __
 * / __| '_ \| | | | __/ _` |/ _ \ \ /\ / / '_ \ _____| '_ ` _ \ / _` | '_ \ / _` |/ _` |/ _ \ '__|
 * \__ \ | | | |_| | || (_| | (_) \ V  V /| | | |_____| | | | | | (_| | | | | (_| | (_| |  __/ |
 * |___/_| |_|\__,_|\__\__,_|\___/ \_/\_/ |_| |_|     |_| |_| |_|\__,_|_| |_|\__,_|\__, |\___|_|
 *                                                                                  |___/
 *
 *  shutdown-manager  --  production shutdown orchestration for Node.js HTTP services
 *
 *  Author  : Ritesh Rana  <contact@riteshrana.engineer>
 *  Support : https://buymeacoffee.com/ritesh.rana
 *  License : MIT
 */
import { EventEmitter } from 'node:events';
import { ConnectionTracker } from './connection-tracker.js';
import { LifecycleState } from './lifecycle.js';
import { ResourceRegistry } from './resource-registry.js';
import { SignalHandler } from './signal-handler.js';
import { resolveKubernetesOptions } from './kubernetes.js';
import type { ResolvedKubernetesOptions } from './kubernetes.js';
import { ShutdownError } from './errors.js';
import { resolveOptions } from './options.js';
import type { ResolvedOptions } from './options.js';
import { runPreShutdownPhase } from './phases/pre-shutdown.js';
import { runDrainingPhase } from './phases/draining.js';
import { runCleanupPhase } from './phases/cleanup.js';
import { transitionAndEmit } from './phases/context.js';
import type { PhaseContext } from './phases/context.js';
import type {
  AnySupportedServer,
  KubernetesOptions,
  LifecyclePhase,
  Logger,
  ResourceFn,
  ResourceOptions,
  ResourceResult,
  ShutdownEventMap,
  ShutdownManagerOptions,
  ShutdownResult,
} from './types.js';

export interface ShutdownManager extends EventEmitter {
  on<K extends keyof ShutdownEventMap>(
    event: K,
    listener: (...args: ShutdownEventMap[K]) => void,
  ): this;
  once<K extends keyof ShutdownEventMap>(
    event: K,
    listener: (...args: ShutdownEventMap[K]) => void,
  ): this;
  off<K extends keyof ShutdownEventMap>(
    event: K,
    listener: (...args: ShutdownEventMap[K]) => void,
  ): this;
  emit<K extends keyof ShutdownEventMap>(event: K, ...args: ShutdownEventMap[K]): boolean;
}

export class ShutdownManager extends EventEmitter {
  private readonly options: ResolvedOptions;
  private readonly logger: Logger;
  private readonly tracker: ConnectionTracker;
  private readonly registry: ResourceRegistry;
  private readonly signalHandler: SignalHandler;
  private readonly lifecycle = new LifecycleState();
  private k8s: ResolvedKubernetesOptions | null = null;
  private ready = true;
  private shutdownPromise: Promise<ShutdownResult> | null = null;
  private socketsDestroyed = 0;
  private exiter: (code: number) => void = (code) => process.exit(code);

  constructor(options: ShutdownManagerOptions = {}) {
    super();
    this.options = resolveOptions(options);
    this.logger = this.options.logger;
    this.tracker = new ConnectionTracker(this.logger);
    this.registry = new ResourceRegistry(this.logger);
    this.signalHandler = new SignalHandler(
      this.options.signals,
      (signal) => this.handleSignal(signal),
      this.logger,
    );

    this.tracker.on('drained', (payload: { remaining: number; secure: boolean }) => {
      this.emit('connection:closed', payload);
    });

    if (this.options.autoStart) {
      this.start();
    }
  }

  attach(server: AnySupportedServer): this {
    if (server === null || typeof server !== 'object') {
      throw new TypeError('attach() requires an HTTP/HTTPS/HTTP2 server instance');
    }
    this.tracker.attach(server);
    return this;
  }

  detach(server: AnySupportedServer): this {
    this.tracker.detach(server);
    return this;
  }

  register(name: string, fn: ResourceFn, opts: ResourceOptions = {}): this {
    this.registry.register(name, fn, opts);
    return this;
  }

  unregister(name: string): boolean {
    return this.registry.unregister(name);
  }

  kubernetes(opts: KubernetesOptions = {}): this {
    this.k8s = resolveKubernetesOptions(opts, this.options.signals);
    return this;
  }

  isReady(): boolean {
    return this.ready;
  }

  isShuttingDown(): boolean {
    return this.lifecycle.phase !== 'idle' && !this.lifecycle.isTerminal();
  }

  phase(): LifecyclePhase {
    return this.lifecycle.phase;
  }

  start(): this {
    this.signalHandler.start();
    return this;
  }

  stop(): this {
    this.signalHandler.stop();
    return this;
  }

  trigger(reason = 'manual'): Promise<ShutdownResult> {
    return this.beginShutdown(reason);
  }

  /** @internal */
  _setExiter(fn: (code: number) => void): void {
    this.exiter = fn;
  }

  /** @internal */
  _getTracker(): ConnectionTracker {
    return this.tracker;
  }

  /** @internal */
  _getRegistry(): ResourceRegistry {
    return this.registry;
  }

  private handleSignal(signal: NodeJS.Signals): void {
    this.logger.info('shutdown:signal', { signal });
    this.beginShutdown(signal).catch((err) => {
      this.logger.error('shutdown:unhandled', { error: (err as Error).message });
      this.emit('error', err as Error);
      if (this.options.forceExit) this.exiter(1);
    });
  }

  private beginShutdown(reason: string): Promise<ShutdownResult> {
    if (this.shutdownPromise !== null) return this.shutdownPromise;
    this.lifecycle.begin();
    this.shutdownPromise = this.runShutdown(reason).then((result) => {
      this.signalHandler.stop();
      if (this.options.forceExit) {
        this.exiter(result.phase === 'failed' ? 1 : 0);
      }
      return result;
    });
    return this.shutdownPromise;
  }

  private async runShutdown(reason: string): Promise<ShutdownResult> {
    const ctx = this.buildPhaseContext();
    const deadline = Date.now() + this.options.timeout;
    let forced = false;
    let resources: ResourceResult[] = [];

    try {
      await runPreShutdownPhase(ctx, reason);

      if (this.options.developmentMode) {
        this.logger.info('shutdown:dev-mode', { skip: 'socket-drain' });
      } else {
        const drainResult = await runDrainingPhase(ctx, deadline);
        forced = drainResult.forced;
        this.socketsDestroyed += drainResult.socketsDestroyed;
      }

      resources = await runCleanupPhase(ctx, deadline);
      const critical = resources.some((r) => r.error && r.critical);
      transitionAndEmit(ctx, critical ? 'failed' : 'done');

      return {
        phase: critical ? 'failed' : 'done',
        durationMs: this.lifecycle.totalDurationMs(),
        reason,
        resources,
        forced,
        socketsDestroyed: this.socketsDestroyed,
      };
    } catch (err) {
      const error =
        err instanceof Error ? err : new ShutdownError(String(err), this.lifecycle.phase);
      if (!this.lifecycle.isTerminal()) {
        try {
          transitionAndEmit(ctx, 'failed');
        } catch {
          // already terminal
        }
      }
      this.emit('error', error);
      this.logger.error('shutdown:error', { phase: this.lifecycle.phase, error: error.message });
      return {
        phase: 'failed',
        durationMs: this.lifecycle.totalDurationMs(),
        reason,
        resources,
        forced,
        socketsDestroyed: this.socketsDestroyed,
      };
    }
  }

  private buildPhaseContext(): PhaseContext {
    return {
      options: this.options,
      logger: this.logger,
      lifecycle: this.lifecycle,
      tracker: this.tracker,
      registry: this.registry,
      k8s: this.k8s,
      emit: (event, ...args) => {
        this.emit(event, ...args);
      },
      setReady: (ready) => {
        this.ready = ready;
      },
    };
  }
}
