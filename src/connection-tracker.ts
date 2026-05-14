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
import type { Socket } from 'node:net';
import type { Server as HttpServer, ServerResponse } from 'node:http';
import { EventEmitter } from 'node:events';
import type { AnySupportedServer, Logger } from './types.js';

interface SocketMeta {
  id: number;
  idle: boolean;
  secure: boolean;
}

interface TrackedServer {
  server: AnySupportedServer;
  listeners: Array<{ event: string; fn: (...args: unknown[]) => void }>;
}

export class ConnectionTracker extends EventEmitter {
  private readonly meta = new WeakMap<Socket, SocketMeta>();
  private readonly sockets = new Set<Socket>();
  private readonly servers: TrackedServer[] = [];
  private counter = 0;
  private shuttingDown = false;

  constructor(private readonly logger: Logger) {
    super();
  }

  attach(server: AnySupportedServer): void {
    if (this.servers.find((s) => s.server === server)) return;
    const tracked: TrackedServer = { server, listeners: [] };

    const onConnection = (socket: Socket): void => this.handleConnection(socket, false);
    const onSecure = (socket: Socket): void => this.handleConnection(socket, true);
    const onRequest = (req: unknown, res: ServerResponse): void => this.handleRequest(req, res);

    server.on('connection', onConnection);
    server.on('secureConnection', onSecure);
    (server as HttpServer).on('request', onRequest);

    tracked.listeners.push(
      { event: 'connection', fn: onConnection as (...args: unknown[]) => void },
      { event: 'secureConnection', fn: onSecure as (...args: unknown[]) => void },
      { event: 'request', fn: onRequest as (...args: unknown[]) => void },
    );

    this.servers.push(tracked);
  }

  detach(server: AnySupportedServer): boolean {
    const idx = this.servers.findIndex((s) => s.server === server);
    if (idx === -1) return false;
    const tracked = this.servers[idx]!;
    for (const { event, fn } of tracked.listeners) {
      server.removeListener(event, fn);
    }
    this.servers.splice(idx, 1);
    return true;
  }

  detachAll(): void {
    for (const tracked of [...this.servers]) {
      this.detach(tracked.server);
    }
  }

  getServers(): AnySupportedServer[] {
    return this.servers.map((s) => s.server);
  }

  closeServers(): Promise<void[]> {
    return Promise.all(
      this.servers.map(
        (tracked) =>
          new Promise<void>((resolve) => {
            tracked.server.close(() => resolve());
          }),
      ),
    );
  }

  markShuttingDown(): void {
    this.shuttingDown = true;
  }

  size(): number {
    return this.sockets.size;
  }

  isIdle(): boolean {
    if (this.sockets.size === 0) return true;
    for (const socket of this.sockets) {
      const m = this.meta.get(socket);
      if (m && !m.idle) return false;
    }
    return true;
  }

  closeIdleKeepAlive(): void {
    for (const socket of this.sockets) {
      const m = this.meta.get(socket);
      if (!m) continue;
      if (m.idle) {
        this.destroySocket(socket);
        continue;
      }
      const response = (socket as Socket & { _httpMessage?: ServerResponse })._httpMessage;
      if (response && !response.headersSent) {
        response.setHeader('Connection', 'close');
      }
    }
  }

  destroyAll(): number {
    let destroyed = 0;
    for (const socket of [...this.sockets]) {
      this.destroySocket(socket);
      destroyed += 1;
    }
    return destroyed;
  }

  private handleConnection(socket: Socket, secure: boolean): void {
    if (this.shuttingDown) {
      socket.destroy();
      return;
    }
    this.counter += 1;
    const id = this.counter;
    this.meta.set(socket, { id, idle: true, secure });
    this.sockets.add(socket);
    this.logger.debug('connection:added', { id, secure, total: this.sockets.size });

    const onClose = (): void => {
      this.sockets.delete(socket);
      this.meta.delete(socket);
      this.emit('drained', { remaining: this.sockets.size, secure });
    };
    socket.once('close', onClose);
  }

  private handleRequest(_req: unknown, res: ServerResponse): void {
    const socket = res.socket as Socket | null;
    if (!socket) return;
    const m = this.meta.get(socket);
    if (!m) return;
    m.idle = false;
    res.once('finish', () => {
      const cur = this.meta.get(socket);
      if (cur) cur.idle = true;
    });
  }

  private destroySocket(socket: Socket): void {
    try {
      socket.destroy();
    } catch (err) {
      this.logger.warn('socket-destroy failed', { error: (err as Error).message });
    }
  }
}
