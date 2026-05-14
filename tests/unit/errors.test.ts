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
import { ResourceError, ShutdownError, TimeoutError } from '../../src/errors.js';

describe('errors', () => {
  it('ShutdownError carries phase + cause', () => {
    const cause = new Error('upstream');
    const err = new ShutdownError('boom', 'draining', { cause });
    expect(err.name).toBe('ShutdownError');
    expect(err.phase).toBe('draining');
    expect(err.cause).toBe(cause);
  });

  it('ResourceError carries name + critical', () => {
    const err = new ResourceError('pg', true, 'pool stuck');
    expect(err.name).toBe('ResourceError');
    expect(err.resourceName).toBe('pg');
    expect(err.critical).toBe(true);
  });

  it('TimeoutError formats message', () => {
    const err = new TimeoutError('cleanup', 30_000);
    expect(err.name).toBe('TimeoutError');
    expect(err.phase).toBe('cleanup');
    expect(err.elapsedMs).toBe(30_000);
    expect(err.message).toMatch(/cleanup/);
    expect(err.message).toMatch(/30000/);
  });
});
