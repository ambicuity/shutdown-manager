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
import { isLogger, noopLogger } from '../../src/logger.js';

describe('logger', () => {
  it('noopLogger has all methods', () => {
    expect(typeof noopLogger.debug).toBe('function');
    expect(typeof noopLogger.info).toBe('function');
    expect(typeof noopLogger.warn).toBe('function');
    expect(typeof noopLogger.error).toBe('function');
    expect(noopLogger.debug('x')).toBeUndefined();
  });

  it('isLogger validates shape', () => {
    expect(isLogger(noopLogger)).toBe(true);
    expect(isLogger(null)).toBe(false);
    expect(isLogger({})).toBe(false);
    expect(isLogger({ debug: 1, info: 1, warn: 1, error: 1 })).toBe(false);
    expect(isLogger(console)).toBe(true);
  });
});
