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
import Fastify from 'fastify';
import { ShutdownManager } from '../../src/index.js';

const fastify = Fastify({ logger: true });

fastify.get('/', async () => ({ hello: 'world' }));

await fastify.listen({ port: 3002, host: '127.0.0.1' });

new ShutdownManager({ timeout: 15_000, logger: console }).attach(fastify.server).register(
  'fastify',
  async () => {
    await fastify.close();
  },
  { critical: true },
);
