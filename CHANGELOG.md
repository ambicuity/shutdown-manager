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

# Changelog

Maintainer: **Ritesh Rana** (`contact@riteshrana.engineer`).
Support development: [buymeacoffee.com/ritesh.rana](https://buymeacoffee.com/ritesh.rana).

All notable changes to this project will be documented in this file. The format
is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-05-14

### Added

- Production-grade `ShutdownManager` class with attach/detach, lifecycle phase machine, and typed events.
- Resource cleanup registry with priority groups, parallel/sequential concurrency, per-resource timeouts, and `critical` flag.
- Kubernetes integration: `kubernetes({ preStopDelayMs, readinessFlipsOn })`, `isReady()`, `isShuttingDown()`.
- `createTestHarness()` for testing shutdown behavior without exiting the test process.
- Legacy `gracefulShutdown(server, options)` factory for users migrating from the prototype.
- Typed errors: `ShutdownError`, `ResourceError`, `TimeoutError`.
- Dual ESM + CJS build, Node ≥ 18.17.
- Zero runtime dependencies.

### Changed

- Replaced recursive promise polling with event-driven drain + single `setTimeout` deadline.
- Replaced socket property mutation (`_connectionId`, `_isIdle`) with a `WeakMap<Socket, meta>`.
- Replaced the `debug` env-var-only logger with a pluggable `Logger` interface.
