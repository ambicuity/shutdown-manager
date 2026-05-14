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
import { transitionAndEmit } from './context.js';
import type { PhaseContext } from './context.js';

export interface DrainResult {
  forced: boolean;
  socketsDestroyed: number;
}

export async function runDrainingPhase(
  ctx: PhaseContext,
  deadline: number,
): Promise<DrainResult> {
  transitionAndEmit(ctx, 'draining');
  ctx.tracker.markShuttingDown();

  if (ctx.tracker.getServers().length === 0) {
    return { forced: false, socketsDestroyed: 0 };
  }

  const closePromise = ctx.tracker.closeServers().then(() => undefined);
  ctx.tracker.closeIdleKeepAlive();

  let drainTimer: NodeJS.Timeout | undefined;
  const drainPromise = new Promise<void>((resolve) => {
    const tick = (): void => {
      if (ctx.tracker.size() === 0) {
        resolve();
        return;
      }
      ctx.tracker.closeIdleKeepAlive();
      drainTimer = setTimeout(tick, ctx.options.pollIntervalMs);
    };
    drainTimer = setTimeout(tick, ctx.options.pollIntervalMs);
  });

  let timeoutHandle: NodeJS.Timeout | undefined;
  const remaining = Math.max(0, deadline - Date.now());
  const timeoutPromise = new Promise<'timeout'>((resolve) => {
    timeoutHandle = setTimeout(() => resolve('timeout'), remaining);
  });

  const winner = await Promise.race([
    Promise.all([closePromise, drainPromise]).then(() => 'drained' as const),
    timeoutPromise,
  ]);

  if (timeoutHandle) clearTimeout(timeoutHandle);
  if (drainTimer) clearTimeout(drainTimer);

  if (winner === 'timeout') {
    const elapsed = ctx.options.timeout;
    ctx.emit('timeout', { phase: 'draining', elapsedMs: elapsed });
    ctx.logger.warn('drain:timeout', { elapsedMs: elapsed });
    const destroyed = ctx.tracker.destroyAll();
    ctx.emit('forced', { socketsDestroyed: destroyed });
    try {
      await ctx.tracker.closeServers();
    } catch {
      // ignore — server may already be closed
    }
    return { forced: true, socketsDestroyed: destroyed };
  }

  return { forced: false, socketsDestroyed: 0 };
}
