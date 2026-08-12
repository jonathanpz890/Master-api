import { Router } from 'express';

export interface HealthRouterOptions {
  isReady: () => boolean;
}

export const createHealthRouter = ({ isReady }: HealthRouterOptions): Router => {
  const router = Router();

  router.get('/', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  router.get('/ready', (_request, response) => {
    const ready = isReady();
    response.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready' });
  });

  return router;
};
