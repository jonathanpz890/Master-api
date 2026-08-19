import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

import { env } from '../config/env.js';
import { AppError } from '../lib/app-error.js';
import { logger } from '../lib/logger.js';

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  if (error instanceof ZodError) {
    logger.warn('Request validation failed', {
      requestId: request.id,
      method: request.method,
      path: request.path,
      issueCount: error.issues.length,
      issuePaths: error.issues.map((issue) => issue.path.join('.')),
    });
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
    logger.warn('Request failed with application error', {
      requestId: request.id,
      method: request.method,
      path: request.path,
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
    });
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

  logger.error('Unhandled request error', {
    requestId: request.id,
    method: request.method,
    path: request.path,
    error,
  });
  response.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : String(error),
      requestId: request.id,
    },
  });
};
