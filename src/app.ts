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
            <span class="service-name">
              <span class="dot ${service.state}"></span>
              <strong>${escapeHtml(serviceLabel(name))}</strong>
            </span>
            <small>${escapeHtml(service.state === 'ready' ? 'Ready' : service.state === 'starting' ? 'Starting' : 'Unavailable')}</small>
          </li>`,
        )
        .join('')
    : '<li class="service"><span class="service-name"><span class="dot starting"></span><strong>Services</strong></span><small>Status unavailable</small></li>';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Microserver API</title>
    <style>
      :root { color-scheme: light; font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      body { background: #f7f7f5; color: #202124; margin: 0; min-height: 100vh; }
      header { align-items: center; border-bottom: 1px solid #e5e5e1; display: flex; height: 64px; justify-content: space-between; padding: 0 max(24px, calc((100vw - 860px) / 2)); }
      .brand { align-items: center; color: inherit; display: flex; font-size: .95rem; font-weight: 650; gap: 10px; letter-spacing: -.01em; text-decoration: none; }.mark { align-items: center; background: #202124; border-radius: 5px; color: white; display: inline-flex; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .8rem; height: 25px; justify-content: center; width: 25px; }
      .meta { color: #74746f; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .72rem; }
      main { margin: 0 auto; max-width: 760px; padding: clamp(60px, 11vh, 128px) 24px 70px; }
      .eyebrow { color: #74746f; font-size: .77rem; font-weight: 600; margin: 0 0 14px; }
      h1 { font-size: clamp(2rem, 5vw, 3.25rem); font-weight: 620; letter-spacing: -.055em; line-height: 1.02; margin: 0; }
      .intro { color: #656560; font-size: 1rem; line-height: 1.55; margin: 16px 0 29px; max-width: 34rem; }
      .status { align-items: center; color: #18794e; display: inline-flex; font-size: .9rem; font-weight: 600; gap: 8px; }.status::before { background: currentColor; border-radius: 50%; content: ""; height: 8px; width: 8px; }.status.starting { color: #a56300; }.status.warning { color: #b33b42; }
      section { border-top: 1px solid #dfdfdb; margin-top: 52px; padding-top: 20px; }.section-title { font-size: .8rem; font-weight: 650; margin: 0 0 13px; }
      ul { border-bottom: 1px solid #dfdfdb; list-style: none; margin: 0; padding: 0; }.service { align-items: center; border-top: 1px solid #e7e7e3; display: flex; justify-content: space-between; min-height: 58px; padding: 0 3px; }.service:first-child { border-top: 0; }.service-name { align-items: center; display: flex; gap: 10px; }.service strong { font-size: .93rem; font-weight: 600; }.service small { color: #6e6e69; font-size: .82rem; }.dot { background: #d49a28; border-radius: 50%; height: 8px; width: 8px; }.dot.ready { background: #279f68; }.dot.failed { background: #d44b53; }
      .actions { display: flex; gap: 20px; margin-top: 28px; }.actions a { color: #343434; font-size: .88rem; font-weight: 600; text-decoration: underline; text-decoration-color: #b8b8b3; text-underline-offset: 4px; }.actions a:hover { text-decoration-color: currentColor; }.actions a.primary { color: #176b46; }
      footer { color: #85857f; font-size: .78rem; margin: 46px 0 0; }
      @media (max-width: 520px) { header { padding: 0 20px; }.meta { display: none; } main { padding: 64px 20px 48px; } }
    </style>
  </head>
  <body>
    <header>
      <a class="brand" href="/"><span class="mark">m</span>Microserver</a>
      <span class="meta">API gateway</span>
    </header>
    <main>
      <p class="eyebrow">System status</p>
      <h1>Microserver is running.</h1>
      <p class="intro">Live availability for the services connected to this API gateway.</p>
      <span class="status ${status.tone}">${status.label}</span>
      <section>
        <p class="section-title">Services</p>
        <ul>${serviceCards}</ul>
      </section>
      <nav class="actions" aria-label="API links">
        <a class="primary" href="/health">View health</a>
        <a href="/api/v1">Browse API</a>
      </nav>
      <footer>Use the versioned routes for application requests.</footer>
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
