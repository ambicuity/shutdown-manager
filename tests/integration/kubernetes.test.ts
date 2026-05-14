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
import { createTestHarness } from '../../src/test-harness.js';
import { startServer } from '../helpers.js';

const managers: ShutdownManager[] = [];
const makeManager = (
  opts: ConstructorParameters<typeof ShutdownManager>[0] = {},
): ShutdownManager => {
  const m = new ShutdownManager({ signals: ['SIGUSR2'], forceExit: false, ...opts });
  managers.push(m);
  return m;
};

afterEach(() => {
  while (managers.length > 0) managers.pop()?.stop();
});

describe('Kubernetes integration', () => {
  it('flips isReady() to false before draining begins', async () => {
    const { server } = await startServer();
    const manager = makeManager({ timeout: 5_000 });
    manager.attach(server);
    manager.kubernetes({ preStopDelayMs: 100, readinessFlipsOn: ['SIGTERM'] });

    let readyAtDrainStart = true;
    manager.on('phase', (p) => {
      if (p.name === 'draining') {
        readyAtDrainStart = manager.isReady();
      }
    });

    expect(manager.isReady()).toBe(true);
    await manager.trigger('SIGTERM');
    expect(readyAtDrainStart).toBe(false);
  });

  it('waits preStopDelayMs before invoking server.close()', async () => {
    const { server } = await startServer();
    const manager = makeManager({ timeout: 5_000 });
    manager.attach(server);
    manager.kubernetes({ preStopDelayMs: 150, readinessFlipsOn: ['SIGTERM'] });

    let drainStartedAt = 0;
    const triggerAt = Date.now();
    manager.on('phase', (p) => {
      if (p.name === 'draining') drainStartedAt = Date.now();
    });

    await manager.trigger('SIGTERM');
    const elapsed = drainStartedAt - triggerAt;
    expect(elapsed).toBeGreaterThanOrEqual(140);
  });

  it('only flips readiness for configured signals', async () => {
    const { server } = await startServer();
    const manager = makeManager({ signals: ['SIGUSR2', 'SIGUSR1'] });
    manager.attach(server);
    manager.kubernetes({ readinessFlipsOn: ['SIGUSR1'] });

    await manager.trigger('SIGUSR2');
    expect(manager.isReady()).toBe(true);
  });
});

describe('Dev mode', () => {
  it('skips socket drain but still runs cleanup hooks', async () => {
    const { server } = await startServer({ delayMs: 5_000 });
    const manager = makeManager({ developmentMode: true });
    manager.attach(server);
    const ran = { redis: false };
    manager.register('redis', () => {
      ran.redis = true;
    });
    const harness = createTestHarness({ manager });

    const start = Date.now();
    const result = await harness.trigger('test');
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(1_000);
    expect(ran.redis).toBe(true);
    expect(result.phase).toBe('done');
    expect(result.forced).toBe(false);
    server.closeAllConnections?.();
  });
});

describe('Legacy gracefulShutdown wrapper', () => {
  it('returns a callable trigger that exposes the manager', async () => {
    const { server } = await startServer();
    const { gracefulShutdown } = await import('../../src/legacy.js');
    const shutdown = gracefulShutdown(server, { signals: ['SIGUSR2'], forceExit: false });
    managers.push(shutdown.manager);

    const result = await shutdown();
    expect(result.phase).toBe('done');
  });
});
