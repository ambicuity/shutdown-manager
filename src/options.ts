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
import { isLogger, noopLogger } from './logger.js';
import type { Logger, ShutdownManagerOptions } from './types.js';

export interface ResolvedOptions {
  signals: NodeJS.Signals[];
  timeout: number;
  developmentMode: boolean;
  forceExit: boolean;
  logger: Logger;
  pollIntervalMs: number;
  autoStart: boolean;
}

export const DEFAULT_OPTIONS: ResolvedOptions = {
  signals: ['SIGTERM', 'SIGINT'],
  timeout: 30_000,
  developmentMode: false,
  forceExit: true,
  logger: noopLogger,
  pollIntervalMs: 100,
  autoStart: true,
};

export function resolveOptions(opts: ShutdownManagerOptions): ResolvedOptions {
  const signals = opts.signals ?? DEFAULT_OPTIONS.signals;
  if (!Array.isArray(signals) || signals.length === 0) {
    throw new TypeError('options.signals must be a non-empty array of signal names');
  }
  for (const s of signals) {
    if (typeof s !== 'string') {
      throw new TypeError('options.signals must contain only signal-name strings');
    }
  }

  const timeout = opts.timeout ?? DEFAULT_OPTIONS.timeout;
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new TypeError('options.timeout must be a positive finite number');
  }

  const pollIntervalMs = opts.poll?.intervalMs ?? DEFAULT_OPTIONS.pollIntervalMs;
  if (!Number.isFinite(pollIntervalMs) || pollIntervalMs <= 0) {
    throw new TypeError('options.poll.intervalMs must be a positive finite number');
  }

  const logger = opts.logger ?? DEFAULT_OPTIONS.logger;
  if (logger !== DEFAULT_OPTIONS.logger && !isLogger(logger)) {
    throw new TypeError('options.logger must implement Logger (debug/info/warn/error)');
  }

  const developmentMode = opts.developmentMode ?? process.env['NODE_ENV'] === 'development';

  return {
    signals,
    timeout,
    developmentMode,
    forceExit: opts.forceExit ?? DEFAULT_OPTIONS.forceExit,
    logger,
    pollIntervalMs,
    autoStart: opts.autoStart ?? DEFAULT_OPTIONS.autoStart,
  };
}
