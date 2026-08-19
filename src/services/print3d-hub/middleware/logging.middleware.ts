import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { logger } from 'mnemonix';

const SENSITIVE_QUERY_KEYS = new Set([
  'token',
  'password',
  'secret',
  'authorization',
  'api_key',
  'key',
  'email',
  'phone',
]);

const sanitizeUrl = (originalUrl: string): string => {
  try {
    const url = new URL(originalUrl, 'http://localhost');
    for (const key of url.searchParams.keys()) {
      if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) url.searchParams.set(key, '[REDACTED]');
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return '[INVALID_URL]';
  }
};

const requestDetails = (req: Request, requestId: string) => ({
  requestId,
  method: req.method,
  url: sanitizeUrl(req.originalUrl),
  ip: req.ip,
  contentType: req.get('content-type') || undefined,
  contentLength: req.get('content-length') || undefined,
  userAgent: req.get('user-agent')?.slice(0, 300) || undefined,
});

/** Logs request lifecycle events without recording bodies, credentials, or cookies. */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = randomUUID();
  const startedAt = process.hrtime.bigint();
  let finished = false;
  res.locals.requestId = requestId;
  const details = requestDetails(req, requestId);

  logger.info('HTTP request received', details);

  res.once('finish', () => {
    finished = true;
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const responseDetails = {
      ...details,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      responseLength: res.getHeader('content-length') || undefined,
    };
    if (res.statusCode >= 500)
      logger.error('HTTP request completed with server error', responseDetails);
    else if (res.statusCode >= 400)
      logger.warn('HTTP request completed with client error', responseDetails);
    else logger.info('HTTP request completed successfully', responseDetails);
  });

  req.once('aborted', () => logger.warn('HTTP request aborted by client', details));
  res.once('close', () => {
    if (!finished) logger.warn('HTTP response connection closed early', details);
  });
  next();
};

export const logUnhandledError = (err: Error, req: Request): void => {
  logger.error('Unhandled request error', {
    ...requestDetails(req, req.res?.locals.requestId || 'unknown'),
    error: { name: err.name, message: err.message, stack: err.stack },
  });
};
