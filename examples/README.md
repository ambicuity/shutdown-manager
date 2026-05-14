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

# Examples

Each example shows how to wire `@ambicuity/shutdown-manager` into a real server. They are deliberately small and idiomatic.

Run them with `tsx`:

```bash
npx tsx examples/express/server.ts
```

Then send `SIGTERM` (`kill -TERM <pid>`) or press `Ctrl+C` to see the lifecycle in action.

| Folder         | What it shows                                                |
| -------------- | ------------------------------------------------------------ |
| `express/`     | Express 5 + resource registry + lifecycle events             |
| `koa/`         | Koa 2 with the same pattern                                  |
| `fastify/`     | Fastify 5 (uses `fastify.server` to attach)                  |
| `http-native/` | Plain `node:http` server                                     |
| `http2/`       | HTTP/2 secure server                                         |
| `kubernetes/`  | Deployment YAML + recipe for `terminationGracePeriodSeconds` |
