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
import { TimeoutError } from '../errors.js';
import { transitionAndEmit } from './context.js';
import type { PhaseContext } from './context.js';
import type { ResourceResult } from '../types.js';

export async function runCleanupPhase(
  ctx: PhaseContext,
  deadline: number,
): Promise<ResourceResult[]> {
  transitionAndEmit(ctx, 'cleanup');
  if (ctx.registry.size() === 0) return [];

  const cleanupBudget = Math.max(0, deadline - Date.now());
  let timedOut = false;
  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<'timeout'>((resolve) => {
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      resolve('timeout');
    }, cleanupBudget);
  });

  const work = ctx.registry.runAll({
    onStart: (name) => ctx.emit('resource:start', { name }),
    onDone: (name, durationMs) => ctx.emit('resource:done', { name, durationMs }),
    onError: (name, error, critical) => ctx.emit('resource:error', { name, error, critical }),
  });

  const winner = await Promise.race([
    work.then((res) => ({ kind: 'done' as const, res })),
    timeoutPromise,
  ]);
  if (timeoutHandle) clearTimeout(timeoutHandle);

  if (winner === 'timeout' || timedOut) {
    ctx.emit('timeout', { phase: 'cleanup', elapsedMs: cleanupBudget });
    ctx.logger.warn('cleanup:timeout', { elapsedMs: cleanupBudget });
    throw new TimeoutError('cleanup', cleanupBudget);
  }
  return winner.res;
}
