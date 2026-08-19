import type { RequestHandler, Router } from 'express';

import { createLazyRouter } from './lazy-router.js';

export const createBangoRouter = (): RequestHandler =>
  createLazyRouter('bango', async () => {
    const modulePath = '../services/bango/router.js';
    const service = (await import(modulePath)) as {
      createBangoRouter: () => Promise<Router>;
    };
    return service.createBangoRouter();
  });
