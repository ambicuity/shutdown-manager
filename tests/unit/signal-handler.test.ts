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
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SignalHandler } from '../../src/signal-handler.js';
import { noopLogger } from '../../src/logger.js';

describe('SignalHandler', () => {
  const handlers: SignalHandler[] = [];

  afterEach(() => {
    while (handlers.length > 0) {
      handlers.pop()?.stop();
    }
  });

  function makeHandler(cb: (s: NodeJS.Signals) => void): SignalHandler {
    const h = new SignalHandler(['SIGUSR2'], cb, noopLogger);
    handlers.push(h);
    return h;
  }

  it('fires once per process signal', () => {
    const cb = vi.fn();
    const h = makeHandler(cb);
    h.start();
    process.emit('SIGUSR2', 'SIGUSR2');
    process.emit('SIGUSR2', 'SIGUSR2');
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith('SIGUSR2');
  });

  it('stop() removes listeners and resets fire count', () => {
    const cb = vi.fn();
    const h = makeHandler(cb);
    h.start();
    process.emit('SIGUSR2', 'SIGUSR2');
    h.stop();
    expect(h.isStarted()).toBe(false);
    process.emit('SIGUSR2', 'SIGUSR2');
    expect(cb).toHaveBeenCalledOnce();
    h.start();
    process.emit('SIGUSR2', 'SIGUSR2');
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('start() is idempotent', () => {
    const cb = vi.fn();
    const h = makeHandler(cb);
    h.start();
    h.start();
    process.emit('SIGUSR2', 'SIGUSR2');
    expect(cb).toHaveBeenCalledOnce();
  });
});
