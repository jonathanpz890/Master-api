import compression from 'compression';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import { env } from './config/env.js';
import { AppError } from './lib/app-error.js';
import { logger } from './lib/logger.js';
import type { Readiness } from './lib/service-readiness.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { requestContext } from './middleware/request-context.js';
import { requestLogger } from './middleware/request-logger.js';
import { createHealthRouter } from './routes/health.router.js';
import { createV1Router } from './routes/v1.router.js';

export interface AppOptions {
  isReady?: () => boolean;
  getReadiness?: () => Readiness;
}

export const createApp = ({
  isReady = () => true,
  getReadiness,
}: AppOptions = {}): express.Express => {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);
  app.use(requestContext);
  app.use(requestLogger);
  app.use(helmet());
  app.use(
    cors({
      // Bynder uses Passport sessions stored in an httpOnly cookie.
      // The browser will not send or accept that cookie cross-origin without this header.
      credentials: true,
      origin: (origin, callback) => {
        if (!origin || env.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        logger.warn('CORS origin rejected', { origin });
        callback(
          new AppError({
            code: 'CORS_ORIGIN_DENIED',
            message: 'Origin is not allowed.',
            statusCode: 403,
          }),
        );
      },
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(
    '/api',
    rateLimit({
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      // Local frontends can issue several duplicate requests during hot reload.
      // Keep production protected without making development testing unusable.
      limit: env.NODE_ENV === 'production' ? 100 : 10_000,
      windowMs: 15 * 60 * 1000,
      handler: (request, response, _next, options) => {
        logger.warn('API rate limit exceeded', {
          requestId: request.id,
          method: request.method,
          path: request.path,
          statusCode: options.statusCode,
        });
        response.status(options.statusCode).send(options.message);
      },
    }),
  );
  app.use('/api/v1', getReadiness ? createV1Router({ getReadiness }) : createV1Router());

  app.use(
    '/health',
    createHealthRouter({
      isReady,
      ...(getReadiness ? { getReadiness } : {}),
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
