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
import { setTimeout as delay } from 'node:timers/promises';
import { shouldFlipReadiness } from '../kubernetes.js';
import { transitionAndEmit } from './context.js';
import type { PhaseContext } from './context.js';

export async function runPreShutdownPhase(ctx: PhaseContext, reason: string): Promise<void> {
  transitionAndEmit(ctx, 'preShutdown');

  if (shouldFlipReadiness(ctx.k8s, reason as NodeJS.Signals | 'manual')) {
    ctx.setReady(false);
    ctx.logger.info('readiness:flipped', { reason });
  }

  if (ctx.k8s !== null && ctx.k8s.preStopDelayMs > 0) {
    ctx.logger.debug('preStop:delay-start', { ms: ctx.k8s.preStopDelayMs });
    await delay(ctx.k8s.preStopDelayMs);
    ctx.logger.debug('preStop:delay-end');
  }
}
