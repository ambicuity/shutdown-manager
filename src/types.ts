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
import type { Server as HttpServer } from 'node:http';
import type { Server as HttpsServer } from 'node:https';
import type { Http2Server, Http2SecureServer } from 'node:http2';

export type AnySupportedServer = HttpServer | HttpsServer | Http2Server | Http2SecureServer;

export type LifecyclePhase = 'idle' | 'preShutdown' | 'draining' | 'cleanup' | 'done' | 'failed';

export type ResourceFn = (signal: AbortSignal) => void | Promise<void>;

export interface ResourceOptions {
  timeout?: number;
  priority?: number;
  concurrency?: 'parallel' | 'sequential';
  critical?: boolean;
}

export interface RegisteredResource {
  name: string;
  fn: ResourceFn;
  options: Required<ResourceOptions>;
}

export interface ResourceResult {
  name: string;
  durationMs: number;
  error?: Error;
  critical: boolean;
}

export interface ShutdownResult {
  phase: 'done' | 'failed';
  durationMs: number;
  reason: string;
  resources: ResourceResult[];
  forced: boolean;
  socketsDestroyed: number;
}

export interface KubernetesOptions {
  preStopDelayMs?: number;
  readinessFlipsOn?: NodeJS.Signals[];
}

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

export interface ShutdownManagerOptions {
  signals?: NodeJS.Signals[];
  timeout?: number;
  developmentMode?: boolean;
  forceExit?: boolean;
  logger?: Logger;
  poll?: { intervalMs?: number };
  autoStart?: boolean;
}

export type ShutdownEventMap = {
  phase: [{ name: LifecyclePhase; durationMs?: number }];
  'connection:closed': [{ remaining: number; secure: boolean }];
  'resource:start': [{ name: string }];
  'resource:done': [{ name: string; durationMs: number }];
  'resource:error': [{ name: string; error: Error; critical: boolean }];
  timeout: [{ phase: LifecyclePhase; elapsedMs: number }];
  forced: [{ socketsDestroyed: number }];
  error: [Error];
};
