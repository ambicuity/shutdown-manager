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
import { LifecycleState } from '../../src/lifecycle.js';

describe('LifecycleState', () => {
  it('starts in idle phase', () => {
    const ls = new LifecycleState();
    expect(ls.phase).toBe('idle');
    expect(ls.isTerminal()).toBe(false);
  });

  it('walks the full happy path', () => {
    const ls = new LifecycleState();
    ls.begin();
    ls.transition('preShutdown');
    ls.transition('draining');
    ls.transition('cleanup');
    ls.transition('done');
    expect(ls.phase).toBe('done');
    expect(ls.isTerminal()).toBe(true);
  });

  it('can move to failed from any pre-terminal phase', () => {
    for (const mid of ['preShutdown', 'draining', 'cleanup'] as const) {
      const ls = new LifecycleState();
      ls.begin();
      ls.transition('preShutdown');
      if (mid !== 'preShutdown') ls.transition('draining');
      if (mid === 'cleanup') ls.transition('cleanup');
      ls.transition('failed');
      expect(ls.phase).toBe('failed');
    }
  });

  it('rejects invalid transitions', () => {
    const ls = new LifecycleState();
    expect(() => ls.transition('draining')).toThrow(/Invalid lifecycle/);
  });

  it('rejects transitions out of terminal phases', () => {
    const ls = new LifecycleState();
    ls.begin();
    ls.transition('preShutdown');
    ls.transition('draining');
    ls.transition('cleanup');
    ls.transition('done');
    expect(() => ls.transition('failed')).toThrow();
  });

  it('reports duration for completed phases', async () => {
    const ls = new LifecycleState();
    ls.begin();
    ls.transition('preShutdown');
    await new Promise((r) => setTimeout(r, 15));
    const result = ls.transition('draining');
    expect(result.durationMs).toBeGreaterThanOrEqual(10);
  });
});
