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
import express from 'express';
import { ShutdownManager } from '../../src/index.js';

const app = express();

app.get('/', (_req, res) => {
  res.send('hello');
});

app.get('/slow', (_req, res) => {
  setTimeout(() => res.send('done'), 2_000);
});

const server = app.listen(3000, () => {
  console.log('express listening on http://127.0.0.1:3000');
});

const shutdown = new ShutdownManager({
  timeout: 15_000,
  logger: console,
}).attach(server);

shutdown.register('cache', async () => {
  console.log('flushing cache...');
});

shutdown.register(
  'postgres',
  async () => {
    console.log('closing pg pool...');
  },
  { priority: 10, critical: true },
);

shutdown.on('phase', ({ name, durationMs }) => {
  console.log(`[shutdown] phase=${name} duration=${durationMs ?? '-'}ms`);
});

app.get('/ready', (_req, res) => {
  if (!shutdown.isReady()) {
    res.status(503).send('not ready');
    return;
  }
  res.send('ready');
});
