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
import { EventEmitter } from 'node:events';
import { describe, it, expect, vi } from 'vitest';
import { ConnectionTracker } from '../../src/connection-tracker.js';
import { noopLogger } from '../../src/logger.js';

class FakeSocket extends EventEmitter {
  public destroyed = false;
  public _httpMessage?: { headersSent?: boolean; setHeader: (k: string, v: string) => void };

  destroy(): void {
    this.destroyed = true;
    this.emit('close');
  }
}

class FakeServer extends EventEmitter {
  close(cb?: () => void): void {
    cb?.();
  }
}

describe('ConnectionTracker', () => {
  it('attaches/detaches servers idempotently', () => {
    const tracker = new ConnectionTracker(noopLogger);
    const server = new FakeServer();

    tracker.attach(server as never);
    tracker.attach(server as never);
    expect(tracker.getServers()).toHaveLength(1);

    expect(tracker.detach(server as never)).toBe(true);
    expect(tracker.detach(server as never)).toBe(false);
    expect(tracker.getServers()).toHaveLength(0);
  });

  it('tracks connection lifecycle and drained event', () => {
    const tracker = new ConnectionTracker(noopLogger);
    const server = new FakeServer();
    tracker.attach(server as never);

    const drained = vi.fn();
    tracker.on('drained', drained);

    const socket = new FakeSocket();
    server.emit('connection', socket);
    expect(tracker.size()).toBe(1);
    expect(tracker.isIdle()).toBe(true);

    socket.emit('close');
    expect(tracker.size()).toBe(0);
    expect(drained).toHaveBeenCalled();
  });

  it('marks active request as non-idle until response finish', () => {
    const tracker = new ConnectionTracker(noopLogger);
    const server = new FakeServer();
    tracker.attach(server as never);

    const socket = new FakeSocket();
    server.emit('connection', socket);

    const res = new EventEmitter() as EventEmitter & { socket: FakeSocket };
    res.socket = socket;
    server.emit('request', {}, res);
    expect(tracker.isIdle()).toBe(false);

    res.emit('finish');
    expect(tracker.isIdle()).toBe(true);
  });

  it('destroys idle sockets and asks active ones to close', () => {
    const tracker = new ConnectionTracker(noopLogger);
    const server = new FakeServer();
    tracker.attach(server as never);

    const idle = new FakeSocket();
    const active = new FakeSocket();
    const setHeader = vi.fn();
    active._httpMessage = { headersSent: false, setHeader };

    server.emit('connection', idle);
    server.emit('connection', active);

    const res = new EventEmitter() as EventEmitter & { socket: FakeSocket };
    res.socket = active;
    server.emit('request', {}, res);

    tracker.closeIdleKeepAlive();

    expect(idle.destroyed).toBe(true);
    expect(active.destroyed).toBe(false);
    expect(setHeader).toHaveBeenCalledWith('Connection', 'close');
  });

  it('destroys new connections immediately once shutting down', () => {
    const tracker = new ConnectionTracker(noopLogger);
    const server = new FakeServer();
    tracker.attach(server as never);
    tracker.markShuttingDown();

    const socket = new FakeSocket();
    server.emit('connection', socket);

    expect(socket.destroyed).toBe(true);
    expect(tracker.size()).toBe(0);
  });

  it('destroyAll and closeServers work', async () => {
    const tracker = new ConnectionTracker(noopLogger);
    const server = new FakeServer();
    tracker.attach(server as never);

    const s1 = new FakeSocket();
    const s2 = new FakeSocket();
    server.emit('connection', s1);
    server.emit('connection', s2);

    expect(tracker.destroyAll()).toBe(2);
    expect(tracker.size()).toBe(0);

    await expect(tracker.closeServers()).resolves.toHaveLength(1);
    tracker.detachAll();
    expect(tracker.getServers()).toHaveLength(0);
  });
});
