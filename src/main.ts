import type { Server } from 'node:http';
import { startHeartbeat } from 'mnemonix';

import { createApp } from './app.js';
import { env } from './config/env.js';
import { aiService } from './lib/ai-service.js';
import { logger } from './lib/logger.js';
import { getReadiness, initializeRequiredServices, type Readiness } from './lib/service-readiness.js';

let shuttingDown = false;

const serviceLabel = (service: string): string =>
  ({ print3dHub: 'Print3D Hub', bynder: 'Bynder' })[service] ?? service;

const logServiceSummary = (readiness: Readiness): void => {
  logger.info(readiness.ready ? 'API ready — services:' : 'API ready with unavailable services:');

  for (const [service, health] of Object.entries(readiness.services)) {
    if (health.state === 'ready') {
      logger.info(`  ✓ ${serviceLabel(service)} — ready`);
      continue;
    }

    logger.warn(
      `  ✗ ${serviceLabel(service)} — ${health.state}${health.error ? `: ${health.error}` : ''}`,
    );
  }

  logger.info('  ○ Bingory — initializes on first request');
};

startHeartbeat();
aiService.start();
const app = createApp({ isReady: () => !shuttingDown, getReadiness });
const server = app.listen(env.PORT, env.HOST, () => {
  logger.info(`API listening on ${env.HOST}:${env.PORT}`);
});

void initializeRequiredServices().then((readiness) => {
  logServiceSummary(readiness);
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled promise rejection', reason);
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception', error);
});

const closeServer = (httpServer: Server): Promise<void> =>
  new Promise((resolve, reject) =>
    httpServer.close((error) => (error ? reject(error) : resolve())),
  );

const shutdown = (signal: NodeJS.Signals): void => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('Graceful shutdown started', { signal });

  const forceExitTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out');
    aiService.stop();
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  closeServer(server)
    .then(() => {
      clearTimeout(forceExitTimer);
      logger.info('HTTP server closed');
      aiService.stop();
      process.exit(0);
    })
    .catch((error: unknown) => {
      clearTimeout(forceExitTimer);
      logger.error('Graceful shutdown failed', error);
      aiService.stop();
      process.exit(1);
    });
};

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
