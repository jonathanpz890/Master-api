import type { Request, RequestHandler } from 'express';

import { logger } from '../lib/logger.js';

const sensitiveQueryKeys = new Set([
  'token',
  'password',
  'secret',
  'authorization',
  'api_key',
  'key',
  'email',
  'phone',
]);

const safePath = (request: Request): string => {
  try {
    const url = new URL(request.originalUrl, 'http://localhost');
    for (const key of url.searchParams.keys()) {
      if (sensitiveQueryKeys.has(key.toLowerCase())) url.searchParams.set(key, '[REDACTED]');
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return '[INVALID_URL]';
  }
};

const requestDetails = (request: Request) => ({
  requestId: request.id,
  method: request.method,
  path: safePath(request),
  origin: request.get('origin') || undefined,
  contentType: request.get('content-type') || undefined,
  contentLength: request.get('content-length') || undefined,
  userAgent: request.get('user-agent')?.slice(0, 300) || undefined,
});

/** Logs each request lifecycle without logging request bodies, cookies, or auth headers. */
export const requestLogger: RequestHandler = (request, response, next) => {
  const startedAt = process.hrtime.bigint();
  const details = requestDetails(request);
  let finished = false;

  logger.info('HTTP request received', details);
  response.once('finish', () => {
    finished = true;
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const completion = {
      ...details,
      statusCode: response.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      responseLength: response.getHeader('content-length') || undefined,
    };
    if (response.statusCode >= 500)
      logger.error('HTTP request completed with server error', completion);
    else if (response.statusCode >= 400)
      logger.warn('HTTP request completed with client error', completion);
    else logger.info('HTTP request completed successfully', completion);
  });
  request.once('aborted', () => logger.warn('HTTP request aborted by client', details));
  response.once('close', () => {
    if (!finished) logger.warn('HTTP response connection closed before completion', details);
  });
  next();
};
