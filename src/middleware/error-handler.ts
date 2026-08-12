import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

import { env } from '../config/env.js';
import { AppError } from '../lib/app-error.js';
import { logger } from '../lib/logger.js';

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: error.issues,
        message: 'The request is invalid.',
        requestId: request.id,
      },
    });
    return;
  }

  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        details: error.details,
        message: error.message,
        requestId: request.id,
      },
    });
    return;
  }

  logger.error({ err: error, requestId: request.id }, 'Unhandled request error');
  response.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : String(error),
      requestId: request.id,
    },
  });
};
