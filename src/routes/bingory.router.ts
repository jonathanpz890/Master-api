import type { RequestHandler, Router } from 'express';

import { createLazyRouter } from './lazy-router.js';

export const createBingoryRouter = (): RequestHandler =>
  createLazyRouter('bingory', async () => {
    const modulePath = '../services/bingory/router.js';
    const service = (await import(modulePath)) as {
      createBingoryRouter: () => Promise<Router>;
    };
    return service.createBingoryRouter();
  });
