import type { Server } from 'node:http';

import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';

let shuttingDown = false;
const app = createApp({ isReady: () => !shuttingDown });
const server = app.listen(env.PORT, env.HOST, () => {
  logger.info({ host: env.HOST, port: env.PORT }, 'API server listening');
});

const closeServer = (httpServer: Server): Promise<void> =>
  new Promise((resolve, reject) => httpServer.close((error) => (error ? reject(error) : resolve())));

const shutdown = (signal: NodeJS.Signals): void => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Graceful shutdown started');

  const forceExitTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out');
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  closeServer(server)
    .then(() => {
      clearTimeout(forceExitTimer);
      logger.info('HTTP server closed');
      process.exit(0);
    })
    .catch((error: unknown) => {
      clearTimeout(forceExitTimer);
      logger.error({ err: error }, 'Graceful shutdown failed');
      process.exit(1);
    });
};

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
