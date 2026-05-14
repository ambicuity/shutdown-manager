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
import { expectTypeOf } from 'expect-type';
import { describe, it } from 'vitest';
import {
  ShutdownManager,
  createTestHarness,
  ShutdownError,
  ResourceError,
  TimeoutError,
} from '../../src/index.js';
import type {
  AnySupportedServer,
  KubernetesOptions,
  LifecyclePhase,
  Logger,
  ResourceFn,
  ResourceOptions,
  ShutdownEventMap,
  ShutdownResult,
  gracefulShutdown,
} from '../../src/index.js';

describe('public API types', () => {
  it('ShutdownManager has the documented surface', () => {
    const m = new ShutdownManager();
    expectTypeOf(m.attach).parameter(0).toEqualTypeOf<AnySupportedServer>();
    expectTypeOf(m.register).parameter(0).toEqualTypeOf<string>();
    expectTypeOf(m.register).parameter(1).toEqualTypeOf<ResourceFn>();
    expectTypeOf(m.register).parameter(2).toEqualTypeOf<ResourceOptions | undefined>();
    expectTypeOf(m.kubernetes).parameter(0).toEqualTypeOf<KubernetesOptions | undefined>();
    expectTypeOf(m.phase()).toEqualTypeOf<LifecyclePhase>();
    expectTypeOf(m.isReady()).toEqualTypeOf<boolean>();
    expectTypeOf(m.trigger).returns.resolves.toEqualTypeOf<ShutdownResult>();
  });

  it('event listeners are typed', () => {
    const m = new ShutdownManager();
    m.on('phase', (payload) => {
      expectTypeOf(payload.name).toEqualTypeOf<LifecyclePhase>();
    });
    m.on('resource:done', (payload) => {
      expectTypeOf(payload.durationMs).toEqualTypeOf<number>();
    });
  });

  it('event map exposes payload tuples', () => {
    expectTypeOf<ShutdownEventMap['phase']>().toEqualTypeOf<
      [{ name: LifecyclePhase; durationMs?: number }]
    >();
    expectTypeOf<ShutdownEventMap['error']>().toEqualTypeOf<[Error]>();
  });

  it('Logger interface matches public type', () => {
    const logger: Logger = { debug() {}, info() {}, warn() {}, error() {} };
    expectTypeOf(logger).toMatchTypeOf<Logger>();
  });

  it('createTestHarness exposes a typed timeline', () => {
    const harness = createTestHarness({ manager: new ShutdownManager() });
    expectTypeOf(harness.timeline()).items.toMatchTypeOf<{ name: LifecyclePhase }>();
  });

  it('gracefulShutdown returns callable with manager', () => {
    expectTypeOf<ReturnType<typeof gracefulShutdown>>().toMatchTypeOf<{
      (): Promise<ShutdownResult>;
      manager: ShutdownManager;
    }>();
  });

  it('errors are exported classes', () => {
    expectTypeOf(ShutdownError).constructorParameters.toMatchTypeOf<
      [string, LifecyclePhase, ...unknown[]]
    >();
    expectTypeOf(ResourceError).constructorParameters.toMatchTypeOf<
      [string, boolean, string, ...unknown[]]
    >();
    expectTypeOf(TimeoutError).constructorParameters.toMatchTypeOf<[LifecyclePhase, number]>();
  });
});
