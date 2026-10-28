import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createApp } from './http/app.js';
import { config } from './config.js';

export function startServer(port = config.port) {
  const server = createApp();
  server.listen(port, () => {
    console.log(`Server listening on port ${server.address().port}`);
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  startServer();
}