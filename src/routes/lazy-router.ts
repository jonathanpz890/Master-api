import type { RequestHandler, Router } from 'express';

import { AppError } from '../lib/app-error.js';

type RouterFactory = () => Router | Promise<Router>;

/** Initialize a feature router only when its namespace receives its first request. */
export const createLazyRouter = (name: string, factory: RouterFactory): RequestHandler => {
  let router: Promise<Router> | undefined;

  return (request, response, next) => {
    router ??= Promise.resolve(factory());
    router
      .then((resolvedRouter) => resolvedRouter(request, response, next))
      .catch((error: unknown) => {
        next(
          new AppError({
            code: 'SERVICE_INITIALIZATION_FAILED',
            message: `The ${name} service could not be initialized.`,
            statusCode: 503,
            details:
              error instanceof Error ? { cause: error.message, service: name } : { service: name },
          }),
        );
      });
  };
};
