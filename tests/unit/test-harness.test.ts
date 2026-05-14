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
import { describe, it, expect } from 'vitest';
import { ShutdownManager } from '../../src/manager.js';
import { createTestHarness } from '../../src/test-harness.js';

describe('createTestHarness', () => {
  it('captures timeline/events and supports reset/detachExit/sendSignal', async () => {
    const manager = new ShutdownManager({
      autoStart: false,
      developmentMode: true,
      forceExit: true,
      signals: ['SIGUSR2'],
      timeout: 200,
    });

    manager.register('cleanup', async () => undefined);

    const harness = createTestHarness({ manager });
    const result = await harness.sendSignal('SIGUSR2');

    expect(result.phase).toBe('done');
    expect(harness.exitCode()).toBe(0);
    expect(harness.timeline().map((p) => p.name)).toEqual(['preShutdown', 'cleanup', 'done']);
    expect(harness.events('resource:start').length).toBe(1);
    expect(harness.events('resource:done').length).toBe(1);

    harness.reset();
    expect(harness.timeline()).toEqual([]);
    expect(harness.events('resource:start')).toEqual([]);

    harness.detachExit();
  });
});
