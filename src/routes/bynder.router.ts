import type { RequestHandler, Router } from 'express';

import { createLazyRouter } from './lazy-router.js';

export const createBynderRouter = (): RequestHandler =>
  createLazyRouter('bynder', async () => {
    const modulePath = '../services/bynder/router.js';
    const service = (await import(modulePath)) as {
      createBynderRouter: () => Promise<Router>;
    };
    return service.createBynderRouter();
  });
