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
import { describe, it, expect, vi } from 'vitest';
import { ResourceRegistry } from '../../src/resource-registry.js';
import { noopLogger } from '../../src/logger.js';

describe('ResourceRegistry', () => {
  it('runs resources and reports durations', async () => {
    const reg = new ResourceRegistry(noopLogger);
    reg.register('a', () => undefined);
    reg.register('b', async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    const results = await reg.runAll();
    expect(results.map((r) => r.name).sort()).toEqual(['a', 'b']);
    for (const r of results) {
      expect(r.error).toBeUndefined();
      expect(r.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('groups by priority ascending', async () => {
    const reg = new ResourceRegistry(noopLogger);
    const order: string[] = [];
    reg.register(
      'late',
      async () => {
        order.push('late');
      },
      { priority: 10 },
    );
    reg.register(
      'early',
      async () => {
        order.push('early');
      },
      { priority: 0 },
    );
    reg.register(
      'mid',
      async () => {
        order.push('mid');
      },
      { priority: 5 },
    );
    await reg.runAll();
    expect(order).toEqual(['early', 'mid', 'late']);
  });

  it('runs parallel within a priority group', async () => {
    const reg = new ResourceRegistry(noopLogger);
    let aStart = 0;
    let bStart = 0;
    reg.register('a', async () => {
      aStart = Date.now();
      await new Promise((r) => setTimeout(r, 50));
    });
    reg.register('b', async () => {
      bStart = Date.now();
      await new Promise((r) => setTimeout(r, 50));
    });
    const start = Date.now();
    await reg.runAll();
    const total = Date.now() - start;
    expect(total).toBeLessThan(95);
    expect(Math.abs(aStart - bStart)).toBeLessThan(20);
  });

  it('runs sequential within a priority group', async () => {
    const reg = new ResourceRegistry(noopLogger);
    const order: string[] = [];
    reg.register(
      'a',
      async () => {
        order.push('a-start');
        await new Promise((r) => setTimeout(r, 30));
        order.push('a-end');
      },
      { concurrency: 'sequential' },
    );
    reg.register(
      'b',
      async () => {
        order.push('b-start');
        await new Promise((r) => setTimeout(r, 10));
        order.push('b-end');
      },
      { concurrency: 'sequential' },
    );
    await reg.runAll();
    expect(order).toEqual(['a-start', 'a-end', 'b-start', 'b-end']);
  });

  it('captures errors and marks critical resources', async () => {
    const reg = new ResourceRegistry(noopLogger);
    reg.register(
      'boom',
      () => {
        throw new Error('nope');
      },
      { critical: true },
    );
    const onError = vi.fn();
    const [result] = await reg.runAll({ onError });
    expect(result?.error).toBeDefined();
    expect(result?.critical).toBe(true);
    expect(onError).toHaveBeenCalledOnce();
  });

  it('times out long-running resources', async () => {
    const reg = new ResourceRegistry(noopLogger);
    reg.register('slow', () => new Promise((r) => setTimeout(r, 1_000)), { timeout: 50 });
    const [result] = await reg.runAll();
    expect(result?.error?.message).toMatch(/timed out/);
  });

  it('rejects duplicate registrations', () => {
    const reg = new ResourceRegistry(noopLogger);
    reg.register('x', () => undefined);
    expect(() => reg.register('x', () => undefined)).toThrow(/already registered/);
  });

  it('validates inputs', () => {
    const reg = new ResourceRegistry(noopLogger);
    expect(() => reg.register('', () => undefined)).toThrow(TypeError);
    // @ts-expect-error testing runtime validation
    expect(() => reg.register('x', null)).toThrow(TypeError);
    expect(() => reg.register('x', () => undefined, { timeout: -1 })).toThrow(TypeError);
  });

  it('unregisters resources', () => {
    const reg = new ResourceRegistry(noopLogger);
    reg.register('x', () => undefined);
    expect(reg.has('x')).toBe(true);
    expect(reg.unregister('x')).toBe(true);
    expect(reg.has('x')).toBe(false);
    expect(reg.unregister('x')).toBe(false);
  });
});
