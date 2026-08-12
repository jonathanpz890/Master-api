import compression from 'compression';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { env } from './config/env.js';
import { AppError } from './lib/app-error.js';
import { logger } from './lib/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { requestContext } from './middleware/request-context.js';
import { createHealthRouter } from './routes/health.router.js';
import { createV1Router } from './routes/v1.router.js';

export interface AppOptions {
  isReady?: () => boolean;
}

export const createApp = ({ isReady = () => true }: AppOptions = {}): express.Express => {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);
  app.use(requestContext);
  app.use(
    pinoHttp({
      logger,
      customProps: (request) => ({ requestId: request.id }),
      genReqId: (request) => request.id,
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || env.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
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
  app.use(
    '/api',
    rateLimit({
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      limit: 100,
      windowMs: 15 * 60 * 1000,
    }),
  );
  app.use('/api/v1', createV1Router());

  // Project proxies need the untouched request stream for multipart uploads.
  // Keep parsing available for future gateway-owned routes registered below.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  app.use('/health', createHealthRouter({ isReady }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
