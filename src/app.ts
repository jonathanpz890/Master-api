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

const escapeHtml = (value: string): string =>
  value.replace(/[&<>'\"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    };
    return entities[character] ?? character;
  });

const serviceLabel = (service: string): string =>
  service === 'print3dHub' ? 'Print3D Hub' : service === 'bynder' ? 'Bynder' : service;

const createHomePage = ({
  isServerReady,
  readiness,
}: {
  isServerReady: boolean;
  readiness?: Readiness;
}): string => {
  const services = readiness ? Object.entries(readiness.services) : [];
  const hasFailedService = services.some(([, service]) => service.state === 'failed');
  const hasStartingService = services.some(([, service]) => service.state === 'starting');
  const status = !isServerReady
    ? { label: 'Shutting down', tone: 'warning' }
    : hasFailedService
      ? { label: 'Needs attention', tone: 'warning' }
      : hasStartingService
        ? { label: 'Warming up', tone: 'starting' }
        : { label: 'Operational', tone: 'ready' };
  const serviceCards = services.length
    ? services
        .map(
          ([name, service]) => `<li class="service">
            <span class="dot ${service.state}"></span>
            <span>
              <strong>${escapeHtml(serviceLabel(name))}</strong>
              <small>${escapeHtml(service.state === 'ready' ? 'Ready' : service.state === 'starting' ? 'Starting' : 'Unavailable')}</small>
            </span>
          </li>`,
        )
        .join('')
    : '<li class="service"><span class="dot starting"></span><span><strong>Services</strong><small>Status unavailable</small></span></li>';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Microserver API</title>
    <style>
      :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      body { align-items: center; background: #f8f7ff; color: #27233a; display: flex; justify-content: center; margin: 0; min-height: 100vh; overflow: hidden; padding: 24px; }
      body::before, body::after { border-radius: 999px; content: ""; filter: blur(8px); opacity: .55; position: fixed; z-index: -1; }
      body::before { background: #dcd1ff; height: 20rem; left: -7rem; top: -5rem; width: 20rem; }
      body::after { background: #c8f1e7; bottom: -8rem; height: 22rem; right: -6rem; width: 22rem; }
      main { background: rgba(255,255,255,.86); border: 1px solid rgba(100,74,163,.13); border-radius: 28px; box-shadow: 0 24px 70px rgba(55,35,104,.14); max-width: 680px; padding: clamp(28px, 6vw, 52px); width: 100%; }
      .eyebrow { color: #7654c7; font-size: .76rem; font-weight: 800; letter-spacing: .12em; margin: 0 0 14px; text-transform: uppercase; }
      h1 { font-size: clamp(2rem, 6vw, 3.4rem); letter-spacing: -.055em; line-height: 1; margin: 0; }
      .intro { color: #686276; font-size: 1.05rem; line-height: 1.55; margin: 18px 0 28px; max-width: 36rem; }
      .status { align-items: center; background: #f0ebff; border-radius: 999px; color: #5c42a4; display: inline-flex; font-size: .88rem; font-weight: 750; gap: 8px; padding: 8px 13px; }
      .status::before { background: currentColor; border-radius: 50%; content: ""; height: 8px; width: 8px; }
      .status.ready { background: #e6f8f0; color: #187b58; }.status.starting { background: #fff4d8; color: #a26400; }.status.warning { background: #ffebed; color: #b83750; }
      .section-title { font-size: .8rem; font-weight: 800; letter-spacing: .1em; margin: 31px 0 12px; text-transform: uppercase; }
      ul { display: grid; gap: 10px; list-style: none; margin: 0; padding: 0; }
      .service { align-items: center; background: #fbfaff; border: 1px solid #eeebf7; border-radius: 14px; display: flex; gap: 12px; padding: 14px 15px; }
      .service strong, .service small { display: block; }.service strong { font-size: .95rem; }.service small { color: #756f83; font-size: .8rem; margin-top: 2px; }
      .dot { background: #f3b33d; border-radius: 50%; height: 10px; width: 10px; }.dot.ready { background: #33b982; }.dot.failed { background: #e65568; }
      .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 28px; }.actions a { border: 1px solid #ded8ed; border-radius: 11px; color: #50398b; font-size: .9rem; font-weight: 750; padding: 11px 14px; text-decoration: none; }.actions a.primary { background: #6e4cb7; border-color: #6e4cb7; color: white; }.actions a:hover { transform: translateY(-1px); }
      footer { color: #8a8497; font-size: .79rem; margin: 27px 0 0; }
    </style>
  </head>
  <body>
    <main>
      <p class="eyebrow">Gateway dashboard</p>
      <h1>Microserver API</h1>
      <p class="intro">A small, friendly front door for the services running behind this API.</p>
      <span class="status ${status.tone}">${status.label}</span>
      <p class="section-title">Service status</p>
      <ul>${serviceCards}</ul>
      <nav class="actions" aria-label="API links">
        <a class="primary" href="/health">Health check</a>
        <a href="/api/v1">API index</a>
      </nav>
      <footer>For application use, connect through the versioned API routes.</footer>
    </main>
  </body>
</html>`;
};

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
  app.get('/', (_request, response) => {
    // Helmet's default CSP deliberately blocks inline styles. This static page
    // has no scripts or external content, so a scoped policy can safely allow
    // its small embedded stylesheet without changing API responses globally.
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; img-src 'self' data:; script-src 'none'; style-src 'unsafe-inline'",
    );
    response.setHeader('Cache-Control', 'no-store');
    response
      .type('html')
      .send(
        createHomePage({
          isServerReady: isReady(),
          ...(getReadiness ? { readiness: getReadiness() } : {}),
        }),
      );
  });
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
