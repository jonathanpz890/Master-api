import { Router, type RequestHandler } from 'express';

import { AppError } from '../lib/app-error.js';
import type { Readiness, ServiceName } from '../lib/service-readiness.js';
import { createBangoRouter } from './bango.router.js';
import { createBynderRouter } from './bynder.router.js';
import { createPrint3dHubRouter } from './print3d-hub.router.js';

interface V1RouterOptions {
  getReadiness?: () => Readiness;
}

const requireService = (
  service: ServiceName,
  getReadiness?: () => Readiness,
): RequestHandler => (_request, _response, next) => {
  const health = getReadiness?.().services[service];
  if (!health || health.state === 'ready') {
    next();
    return;
  }

  next(
    new AppError({
      code: 'SERVICE_NOT_READY',
      message: `The ${service} service is currently unavailable.`,
      statusCode: 503,
      details: { service, state: health.state, ...(health.error ? { cause: health.error } : {}) },
    }),
  );
};

export const createV1Router = ({ getReadiness }: V1RouterOptions = {}): Router => {
  const router = Router();

  router.get('/', (_request, response) => {
    response.status(200).json({ message: 'Microserver API v1' });
  });

  router.use('/blueprint', requireService('print3dHub', getReadiness), createPrint3dHubRouter());
  router.use('/bynder', requireService('bynder', getReadiness), createBynderRouter());
  router.use('/bango', createBangoRouter());

  return router;
};
