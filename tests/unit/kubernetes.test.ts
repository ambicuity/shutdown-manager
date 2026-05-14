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
import { resolveKubernetesOptions, shouldFlipReadiness } from '../../src/kubernetes.js';

describe('kubernetes options', () => {
  it('applies defaults', () => {
    const resolved = resolveKubernetesOptions({}, ['SIGTERM', 'SIGINT']);
    expect(resolved.preStopDelayMs).toBe(5_000);
    expect(resolved.readinessFlipsOn).toEqual(['SIGTERM', 'SIGINT']);
  });

  it('rejects invalid preStopDelayMs', () => {
    expect(() => resolveKubernetesOptions({ preStopDelayMs: -1 }, ['SIGTERM'])).toThrow(TypeError);
    expect(() => resolveKubernetesOptions({ preStopDelayMs: NaN }, ['SIGTERM'])).toThrow(TypeError);
  });

  it('rejects invalid readinessFlipsOn', () => {
    // @ts-expect-error testing runtime validation
    expect(() => resolveKubernetesOptions({ readinessFlipsOn: [123] }, ['SIGTERM'])).toThrow(
      TypeError,
    );
  });
});

describe('shouldFlipReadiness', () => {
  it('always flips when kubernetes not configured', () => {
    expect(shouldFlipReadiness(null, 'SIGTERM')).toBe(true);
    expect(shouldFlipReadiness(null, 'manual')).toBe(true);
  });

  it('flips for configured signals only', () => {
    const resolved = resolveKubernetesOptions({ readinessFlipsOn: ['SIGTERM'] }, [
      'SIGTERM',
      'SIGINT',
    ]);
    expect(shouldFlipReadiness(resolved, 'SIGTERM')).toBe(true);
    expect(shouldFlipReadiness(resolved, 'SIGINT')).toBe(false);
  });

  it('always flips for manual triggers', () => {
    const resolved = resolveKubernetesOptions({ readinessFlipsOn: ['SIGUSR2'] }, ['SIGTERM']);
    expect(shouldFlipReadiness(resolved, 'manual')).toBe(true);
  });
});
