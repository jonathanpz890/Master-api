import type { RequestHandler, Router } from 'express';

import { createLazyRouter } from './lazy-router.js';

export const createPrint3dHubRouter = (): RequestHandler =>
  createLazyRouter('print3d-hub', async () => {
    const modulePath = '../services/print3d-hub/router.js';
    const service = (await import(modulePath)) as {
      createPrint3dHubRouter: () => Router;
    };
    return service.createPrint3dHubRouter();
  });
