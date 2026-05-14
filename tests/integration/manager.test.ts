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
import { startServer, fetchOk } from '../helpers.js';

const managers: ShutdownManager[] = [];

function makeManager(opts: ConstructorParameters<typeof ShutdownManager>[0] = {}): ShutdownManager {
  const m = new ShutdownManager({ signals: ['SIGUSR2'], forceExit: false, ...opts });
  managers.push(m);
  return m;
}

afterEach(() => {
  while (managers.length > 0) managers.pop()?.stop();
});

describe('ShutdownManager — happy path', () => {
  it('drains a server with no in-flight requests', async () => {
    const { server, url, close } = await startServer();
    const manager = makeManager();
    manager.attach(server);

    await fetchOk(url);
    const result = await manager.trigger('test');

    expect(result.phase).toBe('done');
    expect(result.forced).toBe(false);
    expect(result.resources).toEqual([]);
    await close().catch(() => undefined);
  });

  it('runs registered resources in priority order', async () => {
    const { server } = await startServer();
    const manager = makeManager();
    manager.attach(server);

    const order: string[] = [];
    manager.register(
      'pg',
      async () => {
        order.push('pg');
      },
      { priority: 10 },
    );
    manager.register(
      'cache',
      async () => {
        order.push('cache');
      },
      { priority: 0 },
    );

    const result = await manager.trigger('test');
    expect(result.phase).toBe('done');
    expect(order).toEqual(['cache', 'pg']);
  });

  it('marks shutdown failed when a critical resource throws', async () => {
    const { server } = await startServer();
    const manager = makeManager();
    manager.attach(server);
    manager.register(
      'critical',
      () => {
        throw new Error('hard fail');
      },
      { critical: true },
    );

    const result = await manager.trigger('test');
    expect(result.phase).toBe('failed');
    expect(result.resources[0]?.error?.message).toMatch(/hard fail/);
  });

  it('does not fail shutdown for non-critical resource errors', async () => {
    const { server } = await startServer();
    const manager = makeManager();
    manager.attach(server);
    manager.register('soft', () => {
      throw new Error('soft fail');
    });

    const result = await manager.trigger('test');
    expect(result.phase).toBe('done');
    expect(result.resources[0]?.error?.message).toMatch(/soft fail/);
  });
});

describe('ShutdownManager — connection draining', () => {
  it('completes an in-flight request before resolving shutdown', async () => {
    const { server, url } = await startServer({ delayMs: 200 });
    const manager = makeManager({ timeout: 2_000 });
    manager.attach(server);

    const pending = fetchOk(url);
    await new Promise((r) => setTimeout(r, 50));
    const result = await manager.trigger('test');
    const status = await pending;

    expect(status).toBe(200);
    expect(result.phase).toBe('done');
    expect(result.forced).toBe(false);
  });

  it('forces destruction when timeout elapses with stuck connections', async () => {
    const { server, url } = await startServer({ delayMs: 5_000 });
    const manager = makeManager({ timeout: 300 });
    manager.attach(server);

    const controller = new AbortController();
    const pending = fetchOk(url, { signal: controller.signal }).catch(() => 'aborted');
    await new Promise((r) => setTimeout(r, 50));

    const result = await manager.trigger('test');
    controller.abort();
    await pending;

    expect(result.phase).toBe('done');
    expect(result.forced).toBe(true);
    expect(result.socketsDestroyed).toBeGreaterThan(0);
  });
});

describe('ShutdownManager — observability', () => {
  it('emits phase events in order', async () => {
    const { server } = await startServer();
    const manager = makeManager();
    manager.attach(server);
    const harness = createTestHarness({ manager });

    await harness.trigger('test');
    const phases = harness.timeline().map((p) => p.name);
    expect(phases).toEqual(['preShutdown', 'draining', 'cleanup', 'done']);
  });

  it('emits resource:start and resource:done events', async () => {
    const { server } = await startServer();
    const manager = makeManager();
    manager.attach(server);
    manager.register('redis', async () => undefined);
    const harness = createTestHarness({ manager });

    await harness.trigger('test');
    expect(harness.events('resource:start').length).toBe(1);
    expect(harness.events('resource:done').length).toBe(1);
  });

  it('records would-be exit code via the harness', async () => {
    const { server } = await startServer();
    const manager = makeManager({ forceExit: true });
    manager.attach(server);
    const harness = createTestHarness({ manager });

    await harness.trigger('test');
    expect(harness.exitCode()).toBe(0);
  });
});

describe('ShutdownManager — idempotency & state', () => {
  it('second trigger returns the same promise', async () => {
    const { server } = await startServer({ delayMs: 100 });
    const manager = makeManager();
    manager.attach(server);
    const first = manager.trigger('a');
    const second = manager.trigger('b');
    expect(first).toBe(second);
    const result = await first;
    expect(result.reason).toBe('a');
  });

  it('isShuttingDown reflects current state', async () => {
    const { server } = await startServer({ delayMs: 50 });
    const manager = makeManager();
    manager.attach(server);
    expect(manager.isShuttingDown()).toBe(false);
    const promise = manager.trigger('test');
    expect(manager.isShuttingDown()).toBe(true);
    await promise;
    expect(manager.isShuttingDown()).toBe(false);
    expect(manager.phase()).toBe('done');
  });

  it('isReady flips false during preShutdown', async () => {
    const { server } = await startServer();
    const manager = makeManager();
    manager.attach(server);
    expect(manager.isReady()).toBe(true);
    await manager.trigger('test');
    expect(manager.isReady()).toBe(false);
  });
});

describe('ShutdownManager — options validation', () => {
  it('rejects empty signal list', () => {
    expect(() => new ShutdownManager({ signals: [], forceExit: false })).toThrow(TypeError);
  });

  it('rejects non-positive timeout', () => {
    expect(() => new ShutdownManager({ timeout: 0, forceExit: false })).toThrow(TypeError);
  });

  it('rejects non-positive poll interval', () => {
    expect(() => new ShutdownManager({ poll: { intervalMs: 0 }, forceExit: false })).toThrow(
      TypeError,
    );
  });

  it('rejects a non-Logger logger', () => {
    // @ts-expect-error testing runtime validation
    expect(() => new ShutdownManager({ logger: { debug: 1 }, forceExit: false })).toThrow(
      TypeError,
    );
  });
});
