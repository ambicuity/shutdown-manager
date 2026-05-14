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
import { ResourceError } from './errors.js';
import type {
  Logger,
  RegisteredResource,
  ResourceFn,
  ResourceOptions,
  ResourceResult,
} from './types.js';

const DEFAULT_RESOURCE_OPTIONS: Required<ResourceOptions> = {
  timeout: 10_000,
  priority: 0,
  concurrency: 'parallel',
  critical: false,
};

export interface ResourceRunCallbacks {
  onStart?: (name: string) => void;
  onDone?: (name: string, durationMs: number) => void;
  onError?: (name: string, error: Error, critical: boolean) => void;
}

export class ResourceRegistry {
  private readonly resources = new Map<string, RegisteredResource>();

  constructor(private readonly logger: Logger) {}

  register(name: string, fn: ResourceFn, options: ResourceOptions = {}): void {
    if (typeof name !== 'string' || name.length === 0) {
      throw new TypeError('Resource name must be a non-empty string');
    }
    if (typeof fn !== 'function') {
      throw new TypeError(`Resource "${name}" must have a function handler`);
    }
    if (this.resources.has(name)) {
      throw new Error(`Resource "${name}" is already registered`);
    }
    const opts: Required<ResourceOptions> = {
      timeout: options.timeout ?? DEFAULT_RESOURCE_OPTIONS.timeout,
      priority: options.priority ?? DEFAULT_RESOURCE_OPTIONS.priority,
      concurrency: options.concurrency ?? DEFAULT_RESOURCE_OPTIONS.concurrency,
      critical: options.critical ?? DEFAULT_RESOURCE_OPTIONS.critical,
    };
    if (!Number.isFinite(opts.timeout) || opts.timeout <= 0) {
      throw new TypeError(`Resource "${name}" timeout must be > 0`);
    }
    this.resources.set(name, { name, fn, options: opts });
  }

  unregister(name: string): boolean {
    return this.resources.delete(name);
  }

  has(name: string): boolean {
    return this.resources.has(name);
  }

  size(): number {
    return this.resources.size;
  }

  names(): string[] {
    return [...this.resources.keys()];
  }

  clear(): void {
    this.resources.clear();
  }

  async runAll(callbacks: ResourceRunCallbacks = {}): Promise<ResourceResult[]> {
    const groups = this.groupByPriority();
    const results: ResourceResult[] = [];
    for (const group of groups) {
      const parallel = group.filter((r) => r.options.concurrency === 'parallel');
      const sequential = group.filter((r) => r.options.concurrency === 'sequential');

      if (parallel.length > 0) {
        const settled = await Promise.all(parallel.map((r) => this.runOne(r, callbacks)));
        results.push(...settled);
      }
      for (const r of sequential) {
        results.push(await this.runOne(r, callbacks));
      }
    }
    return results;
  }

  private groupByPriority(): RegisteredResource[][] {
    const buckets = new Map<number, RegisteredResource[]>();
    for (const r of this.resources.values()) {
      const arr = buckets.get(r.options.priority) ?? [];
      arr.push(r);
      buckets.set(r.options.priority, arr);
    }
    return [...buckets.entries()].sort(([a], [b]) => a - b).map(([, group]) => group);
  }

  private async runOne(
    resource: RegisteredResource,
    callbacks: ResourceRunCallbacks,
  ): Promise<ResourceResult> {
    callbacks.onStart?.(resource.name);
    this.logger.debug('resource:start', { name: resource.name });

    const start = Date.now();
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), resource.options.timeout);

    try {
      const work = Promise.resolve().then(() => resource.fn(controller.signal));
      const guard = new Promise<never>((_, reject) => {
        controller.signal.addEventListener(
          'abort',
          () =>
            reject(
              new ResourceError(
                resource.name,
                resource.options.critical,
                `Resource "${resource.name}" timed out after ${resource.options.timeout}ms`,
              ),
            ),
          { once: true },
        );
      });
      await Promise.race([work, guard]);
      const durationMs = Date.now() - start;
      callbacks.onDone?.(resource.name, durationMs);
      this.logger.debug('resource:done', { name: resource.name, durationMs });
      return {
        name: resource.name,
        durationMs,
        critical: resource.options.critical,
      };
    } catch (err) {
      const error =
        err instanceof ResourceError
          ? err
          : new ResourceError(
              resource.name,
              resource.options.critical,
              (err as Error)?.message ?? 'Resource failed',
              { cause: err },
            );
      const durationMs = Date.now() - start;
      callbacks.onError?.(resource.name, error, resource.options.critical);
      this.logger.warn('resource:error', {
        name: resource.name,
        critical: resource.options.critical,
        error: error.message,
      });
      return {
        name: resource.name,
        durationMs,
        error,
        critical: resource.options.critical,
      };
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}
