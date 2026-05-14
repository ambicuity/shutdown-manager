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
import type { Logger } from './types.js';

export type SignalCallback = (signal: NodeJS.Signals) => void;

export class SignalHandler {
  private readonly signals: NodeJS.Signals[];
  private readonly callback: SignalCallback;
  private readonly logger: Logger;
  private readonly bound = new Map<NodeJS.Signals, (signal: NodeJS.Signals) => void>();
  private started = false;
  private firedCount = 0;

  constructor(signals: NodeJS.Signals[], callback: SignalCallback, logger: Logger) {
    this.signals = signals;
    this.callback = callback;
    this.logger = logger;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    for (const signal of this.signals) {
      const handler = (received: NodeJS.Signals): void => {
        this.firedCount += 1;
        this.logger.debug('signal:received', { signal: received, count: this.firedCount });
        if (this.firedCount === 1) {
          this.callback(received);
        } else {
          this.logger.warn('signal:repeat-ignored', { signal: received, count: this.firedCount });
        }
      };
      this.bound.set(signal, handler);
      process.on(signal, handler);
    }
  }

  stop(): void {
    if (!this.started) return;
    for (const [signal, handler] of this.bound) {
      process.removeListener(signal, handler);
    }
    this.bound.clear();
    this.started = false;
    this.firedCount = 0;
  }

  isStarted(): boolean {
    return this.started;
  }

  getSignals(): readonly NodeJS.Signals[] {
    return this.signals;
  }
}
