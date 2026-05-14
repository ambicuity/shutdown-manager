<!--
     _           _      _
 ___| |__  _   _| |_ __| | _____      ___ __        _ __ ___   __ _ _ __   __ _  __ _  ___ _ __
/ __| '_ \| | | | __/ _` |/ _ \ \ /\ / / '_ \ _____| '_ ` _ \ / _` | '_ \ / _` |/ _` |/ _ \ '__|
\__ \ | | | |_| | || (_| | (_) \ V  V /| | | |_____| | | | | | (_| | | | | (_| | (_| |  __/ |
|___/_| |_|\__,_|\__\__,_|\___/ \_/\_/ |_| |_|     |_| |_| |_|\__,_|_| |_|\__,_|\__, |\___|_|
                                                                                 |___/

  shutdown-manager  --  production shutdown orchestration for Node.js HTTP services

  Author  : Ritesh Rana  <contact@riteshrana.engineer>
  Support : https://buymeacoffee.com/ritesh.rana
  License : MIT
-->

# `@ambicuity/shutdown-manager`

> Zero-drama shutdown orchestration for production Node.js HTTP services.
> Drain connections, stop new traffic, run cleanup hooks, and exit safely
> across **Docker**, **Kubernetes**, **Express**, **Fastify**, **Koa**, and **native HTTP/HTTP2**.

[![CI](https://github.com/ambicuity/shutdown-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/ambicuity/shutdown-manager/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@ambicuity/shutdown-manager.svg)](https://www.npmjs.com/package/@ambicuity/shutdown-manager)
[![types](https://img.shields.io/badge/types-built--in-blue.svg)](#typescript)
[![runtime deps](https://img.shields.io/badge/runtime--deps-0-brightgreen.svg)](#zero-runtime-dependencies)
[![license](https://img.shields.io/npm/l/@ambicuity/shutdown-manager.svg)](LICENSE)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy_Me_a_Coffee-FFDD00?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/ritesh.rana)

**Author:** Ritesh Rana — `contact@riteshrana.engineer`
**Support development:** [buymeacoffee.com/ritesh.rana](https://buymeacoffee.com/ritesh.rana)

---

## Why?

`server.close()` does not actually drain your server. It stops accepting new
connections and waits for existing ones to close on their own — which, with
HTTP keep-alive, **never happens until the client disconnects**. Meanwhile
Kubernetes already started routing new requests away three seconds ago,
your Postgres pool is sitting on uncommitted work, and the SIGKILL clock
is ticking. That is how rolling deploys drop requests.

`@ambicuity/shutdown-manager` orchestrates the full shutdown lifecycle:

1. Flip readiness to _false_ so load balancers stop sending new traffic.
2. Optionally wait for the LB to react (`preStopDelayMs`).
3. Refuse new connections, set `Connection: close` on idle keep-alives, finish in-flight requests.
4. Run your cleanup hooks (Postgres, Redis, queues, telemetry flush) in priority order.
5. Exit `0` if everything was clean, `1` if a critical resource failed or a timeout fired.

## Install

```bash
npm install @ambicuity/shutdown-manager
```

Requires **Node.js ≥ 18.17**. Ships **dual ESM + CJS** with built-in TypeScript types.

## Quickstart (TypeScript)

```ts
import express from 'express';
import { ShutdownManager } from '@ambicuity/shutdown-manager';

const app = express();
const server = app.listen(3000);

const shutdown = new ShutdownManager({ timeout: 15_000 })
  .attach(server)
  .register('postgres', () => pool.end(), { priority: 10, critical: true })
  .register('redis', () => redis.quit())
  .register('bullmq', () => worker.close());

app.get('/ready', (_req, res) =>
  shutdown.isReady() ? res.send('ok') : res.status(503).send('shutting down'),
);
```

That's it. SIGTERM and SIGINT are wired automatically. On signal, the manager
walks the lifecycle and exits the process when it's done.

### CommonJS

```js
const { ShutdownManager } = require('@ambicuity/shutdown-manager');
const shutdown = new ShutdownManager().attach(server);
```

## Lifecycle

```
  idle  ─►  preShutdown  ─►  draining  ─►  cleanup  ─►  done | failed
            (flip ready,     (server.close,  (run resources    (exit
             optional         drain sockets,  by priority,      0 or 1)
             preStop delay)   force on        critical=true
                              timeout)        ⇒ failed)
```

Every phase emits a typed event you can hook for logging or metrics.

## API

### `new ShutdownManager(options?)`

```ts
interface ShutdownManagerOptions {
  signals?: NodeJS.Signals[]; // default ['SIGTERM','SIGINT']
  timeout?: number; // total budget ms, default 30_000
  developmentMode?: boolean; // default: NODE_ENV === 'development'
  forceExit?: boolean; // default true
  logger?: Logger; // default: silent noop
  poll?: { intervalMs?: number }; // default 100
  autoStart?: boolean; // default true
}
```

### Methods

| Method                       | Purpose                                                        |
| ---------------------------- | -------------------------------------------------------------- |
| `.attach(server)`            | Track an `http`, `https`, `http2`, or `http2.secure` server    |
| `.detach(server)`            | Stop tracking a server                                         |
| `.register(name, fn, opts?)` | Register a cleanup hook                                        |
| `.unregister(name)`          | Remove a previously registered hook                            |
| `.kubernetes(opts)`          | Enable preStop delay + readiness flip                          |
| `.isReady()`                 | `false` once shutdown begins (wire to your `/ready` endpoint)  |
| `.isShuttingDown()`          | `true` while a shutdown is in progress                         |
| `.phase()`                   | Current `LifecyclePhase`                                       |
| `.trigger(reason?)`          | Manually run the shutdown lifecycle (returns `ShutdownResult`) |
| `.start()` / `.stop()`       | Attach / detach signal handlers                                |
| `.on(event, handler)`        | Typed event subscription                                       |

### Resource registry

```ts
shutdown.register(
  'postgres',
  async (signal) => {
    // signal is an AbortSignal — honor it for cooperative cancellation
    await pool.end();
  },
  {
    timeout: 5_000, // per-resource budget; default 10_000
    priority: 10, // lower runs first; default 0
    concurrency: 'parallel', // 'parallel' (default) or 'sequential' within a priority group
    critical: true, // a failure marks the whole shutdown as failed (exit 1)
  },
);
```

### Events

```ts
shutdown.on('phase',            ({ name, durationMs }) => …);
shutdown.on('connection:closed', ({ remaining, secure }) => …);
shutdown.on('resource:start',    ({ name }) => …);
shutdown.on('resource:done',     ({ name, durationMs }) => …);
shutdown.on('resource:error',    ({ name, error, critical }) => …);
shutdown.on('timeout',           ({ phase, elapsedMs }) => …);
shutdown.on('forced',            ({ socketsDestroyed }) => …);
shutdown.on('error',             (err) => …);
```

## Kubernetes

```ts
const shutdown = new ShutdownManager({ timeout: 15_000 })
  .attach(server)
  .kubernetes({ preStopDelayMs: 5_000 });
```

What this does:

- Flips `isReady()` to `false` _immediately_ on SIGTERM.
- Waits `preStopDelayMs` before calling `server.close()` so the Service has
  time to mark the pod NotReady and stop routing new traffic.
- Lets your `terminationGracePeriodSeconds` budget remain predictable
  (≈ `preStopDelayMs + timeout + 1–2s buffer`).

See [`examples/kubernetes/`](examples/kubernetes/) for the full Deployment YAML.

## Docker

Set `STOPSIGNAL SIGTERM` in your Dockerfile (Node's default `npm` wrapper
sometimes swallows signals — running `node` directly avoids that). Use
`tini` or `dumb-init` as PID 1 if you need to reap zombies.

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci --omit=dev
STOPSIGNAL SIGTERM
CMD ["node", "dist/server.js"]
```

## Framework support

| Framework | Attach                                                       |
| --------- | ------------------------------------------------------------ |
| Express   | `manager.attach(app.listen(...))`                            |
| Koa       | `manager.attach(app.listen(...))`                            |
| Fastify   | `manager.attach(fastify.server)`                             |
| NestJS    | `manager.attach(app.getHttpServer())`                        |
| Hono      | `manager.attach(serve({ fetch: app.fetch }))` (Node adapter) |
| raw HTTP  | `manager.attach(http.createServer(...))`                     |
| HTTP/2    | `manager.attach(http2.createSecureServer(...))`              |

## Testing

```ts
import { ShutdownManager, createTestHarness } from '@ambicuity/shutdown-manager';

const manager = new ShutdownManager({ signals: ['SIGUSR2'], forceExit: true });
const harness = createTestHarness({ manager });

await harness.sendSignal('SIGUSR2');

expect(harness.exitCode()).toBe(0);
expect(harness.timeline().map((p) => p.name)).toEqual([
  'preShutdown',
  'draining',
  'cleanup',
  'done',
]);
```

The harness intercepts `process.exit` so the test process stays alive.

## Comparison

| Feature                                 | this | http-graceful-shutdown | terminus | lil-http-terminator |
| --------------------------------------- | :--: | :--------------------: | :------: | :-----------------: |
| TypeScript-first                        |  ✅  |           ❌           |    ⚠️    |         ⚠️          |
| ESM + CJS dual build                    |  ✅  |           ❌           |    ⚠️    |         ✅          |
| Zero runtime deps                       |  ✅  |           ❌           |    ❌    |         ✅          |
| Resource registry (priority + parallel) |  ✅  |           ❌           |    ✅    |         ❌          |
| Typed lifecycle events                  |  ✅  |           ⚠️           |    ✅    |         ❌          |
| Kubernetes-aware (readiness + preStop)  |  ✅  |           ❌           |    ⚠️    |         ❌          |
| Testing harness                         |  ✅  |           ❌           |    ❌    |         ❌          |
| npm provenance                          |  ✅  |           ❌           |    ❌    |         ❌          |

## How to start using this in an existing codebase?

```ts
import { ShutdownManager } from '@ambicuity/shutdown-manager';
const manager = new ShutdownManager({ timeout: 10_000 }).attach(server);
```

## Zero runtime dependencies

This package has **zero** runtime dependencies. It uses only the Node.js standard library. Releases are published with `--provenance` and signed via GitHub Actions OIDC.

## Support

If this package saves you a 3am incident, consider buying me a coffee:
[buymeacoffee.com/ritesh.rana](https://buymeacoffee.com/ritesh.rana).

For commercial support or custom integration questions, email
`contact@riteshrana.engineer`.

## License

MIT © Ritesh Rana (`contact@riteshrana.engineer`)
