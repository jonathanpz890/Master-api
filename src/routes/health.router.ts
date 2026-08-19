import { Router } from 'express';
import type { Readiness } from '../lib/service-readiness.js';

export interface HealthRouterOptions {
  isReady: () => boolean;
  getReadiness?: () => Readiness;
}

export const createHealthRouter = ({ isReady, getReadiness }: HealthRouterOptions): Router => {
  const router = Router();

  router.get('/', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  router.get('/ready', (_request, response) => {
    const readiness = getReadiness?.();
    const acceptingTraffic = isReady();
    const status = !acceptingTraffic ? 'not_ready' : readiness?.ready === false ? 'degraded' : 'ready';
    response.status(acceptingTraffic ? 200 : 503).json({
      status,
      ...(readiness ? { services: readiness.services } : {}),
    });
  });

  return router;
};
