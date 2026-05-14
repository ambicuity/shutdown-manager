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
import Koa from 'koa';
import { ShutdownManager } from '../../src/index.js';

const app = new Koa();
app.use(async (ctx) => {
  ctx.body = 'hello from koa';
});

const server = app.listen(3001, () => {
  console.log('koa listening on http://127.0.0.1:3001');
});

new ShutdownManager({ timeout: 15_000, logger: console })
  .attach(server)
  .register('redis', async () => {
    console.log('closing redis...');
  });
