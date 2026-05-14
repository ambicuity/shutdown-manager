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
import type { ShutdownManager } from './manager.js';
import type { LifecyclePhase, ShutdownEventMap, ShutdownResult } from './types.js';

export interface TestHarnessOptions {
  manager: ShutdownManager;
}

export interface PhaseTimelineEntry {
  name: LifecyclePhase;
  at: number;
  durationMs?: number;
}

export interface TestHarness {
  manager: ShutdownManager;
  exitCode(): number | null;
  timeline(): PhaseTimelineEntry[];
  events<K extends keyof ShutdownEventMap>(name: K): ShutdownEventMap[K][];
  trigger(reason?: string): Promise<ShutdownResult>;
  sendSignal(signal: NodeJS.Signals): Promise<ShutdownResult>;
  reset(): void;
  detachExit(): void;
}

/**
 * Creates a harness that lets tests drive the manager without killing the
 * test process. `forceExit` is intercepted so `process.exit` is never called;
 * the would-be exit code is recorded for assertions.
 */
export function createTestHarness({ manager }: TestHarnessOptions): TestHarness {
  let exitCode: number | null = null;
  const timeline: PhaseTimelineEntry[] = [];
  const eventLog = new Map<keyof ShutdownEventMap, unknown[][]>();

  manager._setExiter((code: number) => {
    exitCode = code;
  });

  manager.on('phase', (payload) => {
    timeline.push({ name: payload.name, at: Date.now(), durationMs: payload.durationMs });
  });

  const recordable: (keyof ShutdownEventMap)[] = [
    'phase',
    'connection:closed',
    'resource:start',
    'resource:done',
    'resource:error',
    'timeout',
    'forced',
    'error',
  ];
  for (const name of recordable) {
    eventLog.set(name, []);
    manager.on(name, (...args: unknown[]) => {
      eventLog.get(name)!.push(args);
    });
  }

  return {
    manager,
    exitCode: () => exitCode,
    timeline: () => [...timeline],
    events<K extends keyof ShutdownEventMap>(name: K): ShutdownEventMap[K][] {
      return (eventLog.get(name) ?? []) as ShutdownEventMap[K][];
    },
    trigger: (reason = 'manual') => manager.trigger(reason),
    sendSignal: (signal) => manager.trigger(signal),
    reset() {
      exitCode = null;
      timeline.length = 0;
      for (const arr of eventLog.values()) arr.length = 0;
    },
    detachExit() {
      manager._setExiter(() => undefined);
    },
  };
}
