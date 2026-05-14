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
import { ShutdownManager } from './manager.js';
import type { AnySupportedServer, ShutdownManagerOptions, ShutdownResult } from './types.js';

/**
 * Legacy factory matching the prototype `gracefulShutdown(server, options)` shape.
 *
 * Returns a manual-shutdown function for tests; the underlying manager is also
 * attached to signals so SIGTERM/SIGINT trigger shutdown automatically.
 *
 * Prefer `new ShutdownManager(opts).attach(server)` in new code.
 */
export function gracefulShutdown(
  server: AnySupportedServer,
  options: ShutdownManagerOptions = {},
): {
  (): Promise<ShutdownResult>;
  manager: ShutdownManager;
} {
  const manager = new ShutdownManager(options);
  manager.attach(server);
  const trigger = (): Promise<ShutdownResult> => manager.trigger('manual');
  return Object.assign(trigger, { manager });
}
