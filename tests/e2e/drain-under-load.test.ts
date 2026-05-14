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
import { describe, it, expect, afterEach } from 'vitest';
import { ShutdownManager } from '../../src/manager.js';
import { startServer, fetchOk } from '../helpers.js';

const managers: ShutdownManager[] = [];

afterEach(() => {
  while (managers.length > 0) managers.pop()?.stop();
});

describe('end-to-end drain under load', () => {
  it('drops zero responses for in-flight requests during SIGTERM-equivalent', async () => {
    const { server, url } = await startServer({ delayMs: 100 });
    const manager = new ShutdownManager({
      signals: ['SIGUSR2'],
      forceExit: false,
      timeout: 5_000,
    });
    managers.push(manager);
    manager.attach(server);

    const N = 25;
    const inflight = Array.from({ length: N }, () => fetchOk(url));
    await new Promise((r) => setTimeout(r, 30));
    const result = await manager.trigger('SIGTERM');
    const responses = await Promise.all(inflight);

    expect(responses.every((s) => s === 200)).toBe(true);
    expect(result.phase).toBe('done');
    expect(result.forced).toBe(false);
  });

  it('rejects new connections once drain has started', async () => {
    const { server, port } = await startServer({ delayMs: 200 });
    const manager = new ShutdownManager({
      signals: ['SIGUSR2'],
      forceExit: false,
      timeout: 5_000,
    });
    managers.push(manager);
    manager.attach(server);

    const inflight = fetchOk(`http://127.0.0.1:${port}`);
    await new Promise((r) => setTimeout(r, 30));
    const triggerPromise = manager.trigger('test');
    await new Promise((r) => setTimeout(r, 30));

    let postShutdownError: Error | null = null;
    try {
      await fetchOk(`http://127.0.0.1:${port}`);
    } catch (err) {
      postShutdownError = err as Error;
    }

    await triggerPromise;
    await inflight;

    expect(postShutdownError).not.toBeNull();
  });
});
