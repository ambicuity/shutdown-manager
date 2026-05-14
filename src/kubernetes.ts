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
import type { KubernetesOptions } from './types.js';

export interface ResolvedKubernetesOptions {
  preStopDelayMs: number;
  readinessFlipsOn: NodeJS.Signals[];
}

export function resolveKubernetesOptions(
  opts: KubernetesOptions,
  fallbackSignals: NodeJS.Signals[],
): ResolvedKubernetesOptions {
  const preStopDelayMs = opts.preStopDelayMs ?? 5_000;
  if (!Number.isFinite(preStopDelayMs) || preStopDelayMs < 0) {
    throw new TypeError('kubernetes.preStopDelayMs must be a non-negative finite number');
  }
  const readinessFlipsOn = opts.readinessFlipsOn ?? fallbackSignals;
  if (!Array.isArray(readinessFlipsOn) || readinessFlipsOn.some((s) => typeof s !== 'string')) {
    throw new TypeError('kubernetes.readinessFlipsOn must be an array of signal names');
  }
  return { preStopDelayMs, readinessFlipsOn };
}

export function shouldFlipReadiness(
  resolved: ResolvedKubernetesOptions | null,
  signal: NodeJS.Signals | 'manual',
): boolean {
  if (resolved === null) return true;
  if (signal === 'manual') return true;
  return resolved.readinessFlipsOn.includes(signal);
}
