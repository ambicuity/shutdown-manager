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
import type { LifecyclePhase } from './types.js';

export class ShutdownError extends Error {
  override readonly name = 'ShutdownError';
  readonly phase: LifecyclePhase;

  constructor(message: string, phase: LifecyclePhase, options?: { cause?: unknown }) {
    super(message, options);
    this.phase = phase;
  }
}

export class ResourceError extends Error {
  override readonly name = 'ResourceError';
  readonly resourceName: string;
  readonly critical: boolean;

  constructor(
    resourceName: string,
    critical: boolean,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.resourceName = resourceName;
    this.critical = critical;
  }
}

export class TimeoutError extends Error {
  override readonly name = 'TimeoutError';
  readonly phase: LifecyclePhase;
  readonly elapsedMs: number;

  constructor(phase: LifecyclePhase, elapsedMs: number) {
    super(`${phase} exceeded budget after ${elapsedMs}ms`);
    this.phase = phase;
    this.elapsedMs = elapsedMs;
  }
}
