import type { RequestHandler } from 'express';

import { AppError } from '../lib/app-error.js';

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(
    new AppError({
      code: 'ROUTE_NOT_FOUND',
      message: `No route matches ${request.method} ${request.originalUrl}`,
      statusCode: 404,
    }),
  );
};
