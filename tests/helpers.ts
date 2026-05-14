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
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ShutdownManager } from '../src/manager.js';

export interface RunningServer {
  server: http.Server;
  url: string;
  port: number;
  close(): Promise<void>;
}

export interface CreateServerOptions {
  handler?: http.RequestListener;
  delayMs?: number;
}

export async function startServer(opts: CreateServerOptions = {}): Promise<RunningServer> {
  const handler =
    opts.handler ??
    ((_req, res) => {
      const finish = (): void => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
      };
      if (opts.delayMs && opts.delayMs > 0) {
        setTimeout(finish, opts.delayMs);
      } else {
        finish();
      }
    });
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as AddressInfo;
  return {
    server,
    port: address.port,
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}

export async function fetchOk(url: string, opts: { signal?: AbortSignal } = {}): Promise<number> {
  const res = await fetch(url, { signal: opts.signal });
  await res.arrayBuffer();
  return res.status;
}

export function detachExit(manager: ShutdownManager): void {
  manager._setExiter(() => undefined);
}
