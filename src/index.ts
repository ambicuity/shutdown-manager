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
export { ShutdownManager } from './manager.js';
export { gracefulShutdown } from './legacy.js';
export { createTestHarness } from './test-harness.js';
export { ShutdownError, ResourceError, TimeoutError } from './errors.js';
export { noopLogger } from './logger.js';

export type {
  AnySupportedServer,
  KubernetesOptions,
  LifecyclePhase,
  Logger,
  RegisteredResource,
  ResourceFn,
  ResourceOptions,
  ResourceResult,
  ShutdownEventMap,
  ShutdownManagerOptions,
  ShutdownResult,
} from './types.js';

export type { TestHarness, TestHarnessOptions, PhaseTimelineEntry } from './test-harness.js';
