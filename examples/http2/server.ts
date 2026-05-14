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
import http2 from 'node:http2';
import fs from 'node:fs';
import path from 'node:path';
import { ShutdownManager } from '../../src/index.js';

/**
 * Generate self-signed certs first:
 *   openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj '/CN=localhost'
 */
const server = http2.createSecureServer({
  key: fs.readFileSync(path.resolve('key.pem')),
  cert: fs.readFileSync(path.resolve('cert.pem')),
});

server.on('stream', (stream) => {
  stream.respond({ ':status': 200, 'content-type': 'text/plain' });
  stream.end('hello over h2');
});

server.listen(3004, () => {
  console.log('http2 listening on https://127.0.0.1:3004');
});

new ShutdownManager({ timeout: 10_000, logger: console }).attach(server);
