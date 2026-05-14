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

# Kubernetes recipe

This recipe wires `@ambicuity/shutdown-manager` into a Kubernetes Deployment so rolling updates drain cleanly.

## Required pieces

1. **Readiness probe** must read `manager.isReady()`. Once a pod starts shutting down, the probe returns 503 and the Service stops sending it new traffic.
2. **`terminationGracePeriodSeconds`** ≥ `preStopDelayMs + timeout + buffer`.
3. **`preStop` hook OR `kubernetes({ preStopDelayMs })`**. Either one buys time for the load balancer to de-register the endpoint _before_ you stop accepting new connections.

## Why both `preStop` and `preStopDelayMs`?

You can pick one:

- **`preStop` sleep** (in `deployment.yaml`): platform-native, works for any language. The kubelet runs it _before_ sending SIGTERM, so the readiness probe has already started failing by then.
- **`kubernetes({ preStopDelayMs })`** (in code): travels with your app. Useful when you can't change the manifest, or you want the same delay locally and in CI.

Most teams just pick the one that fits their workflow. Using both is harmless but adds the delays together.

## App code

```ts
import express from 'express';
import { ShutdownManager } from '@ambicuity/shutdown-manager';

const app = express();
const server = app.listen(3000);

const shutdown = new ShutdownManager({ timeout: 15_000 })
  .attach(server)
  .kubernetes({ preStopDelayMs: 5_000 });

app.get('/ready', (_req, res) =>
  shutdown.isReady() ? res.send('ok') : res.status(503).send('shutting down'),
);

app.get('/healthz', (_req, res) => res.send('ok'));
```

See `deployment.yaml` next to this file for the full Kubernetes manifest.
