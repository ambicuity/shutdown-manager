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
import type { ConnectionTracker } from '../connection-tracker.js';
import type { ResourceRegistry } from '../resource-registry.js';
import type { LifecycleState } from '../lifecycle.js';
import type { ResolvedKubernetesOptions } from '../kubernetes.js';
import type { ResolvedOptions } from '../options.js';
import type { LifecyclePhase, Logger, ShutdownEventMap } from '../types.js';

export type TypedEmit = <K extends keyof ShutdownEventMap>(
  event: K,
  ...args: ShutdownEventMap[K]
) => void;

export interface PhaseContext {
  readonly options: ResolvedOptions;
  readonly logger: Logger;
  readonly lifecycle: LifecycleState;
  readonly tracker: ConnectionTracker;
  readonly registry: ResourceRegistry;
  readonly k8s: ResolvedKubernetesOptions | null;
  readonly emit: TypedEmit;
  readonly setReady: (ready: boolean) => void;
}

export function transitionAndEmit(ctx: PhaseContext, to: LifecyclePhase): void {
  const { durationMs } = ctx.lifecycle.transition(to);
  ctx.emit('phase', { name: to, durationMs });
  ctx.logger.debug('phase:transition', { name: to, durationMs });
}
