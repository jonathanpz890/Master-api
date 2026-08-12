import { Router } from 'express';

import { env } from '../config/env.js';
import { createServiceProxy } from './service-proxy.js';

/**
 * Project APIs remain independently deployable, while the gateway provides a
 * stable public entry point for callers that want one API origin.
 */
export const createV1Router = (): Router => {
  const router = Router();

  router.get('/', (_request, response) => {
    response.status(200).json({ message: 'Microserver API v1' });
  });

  router.use(
    '/print3d-hub',
    createServiceProxy({ name: 'print3d-hub', target: env.PRINT3D_HUB_API_URL }),
  );
  router.use('/bynder', createServiceProxy({ name: 'bynder', target: env.BYNDER_API_URL }));
  router.use('/bango', createServiceProxy({ name: 'bango', target: env.BANGO_API_URL }));

  return router;
};
