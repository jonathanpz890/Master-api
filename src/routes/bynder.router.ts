import type { RequestHandler, Router } from 'express';

import { createLazyRouter } from './lazy-router.js';

let bynderRouter: Promise<Router> | undefined;

/** Build the service router once so it can be warmed during service startup. */
export const initializeBynderRouter = (): Promise<Router> => {
  bynderRouter ??= (async () => {
    const modulePath = '../services/bynder/router.js';
    const service = (await import(modulePath)) as {
      createBynderRouter: () => Promise<Router>;
    };
    return service.createBynderRouter();
  })();
  return bynderRouter;
};

export const createBynderRouter = (): RequestHandler =>
  createLazyRouter('bynder', initializeBynderRouter);
