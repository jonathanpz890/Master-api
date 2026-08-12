import type { RequestHandler } from 'express';

import { AppError } from '../lib/app-error.js';

interface ServiceProxyOptions {
  name: string;
  target: string;
}

const hopByHopHeaders = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

/** Forward a namespaced gateway request to an independently running project API. */
export const createServiceProxy = ({ name, target }: ServiceProxyOptions): RequestHandler => {
  return async (request, response, next) => {
    try {
      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (!hopByHopHeaders.has(key) && value !== undefined) {
          headers.set(key, Array.isArray(value) ? value.join(', ') : value);
        }
      }
      headers.set('x-forwarded-host', request.get('host') ?? '');
      headers.set('x-forwarded-proto', request.protocol);

      const method = request.method.toUpperCase();
      const requestInit: RequestInit & { duplex?: 'half' } = {
        headers,
        method,
        redirect: 'manual',
      };
      if (method !== 'GET' && method !== 'HEAD') {
        // Node requires this when an incoming request stream is used as a fetch body.
        requestInit.body = request as unknown as NonNullable<RequestInit['body']>;
        requestInit.duplex = 'half';
      }
      const upstreamResponse = await fetch(new URL(request.url, target), requestInit);

      upstreamResponse.headers.forEach((value, key) => {
        if (!hopByHopHeaders.has(key)) response.setHeader(key, value);
      });
      response
        .status(upstreamResponse.status)
        .send(Buffer.from(await upstreamResponse.arrayBuffer()));
    } catch (error) {
      next(
        new AppError({
          code: 'UPSTREAM_UNAVAILABLE',
          message: `The ${name} service is unavailable.`,
          statusCode: 503,
          details:
            error instanceof Error ? { cause: error.message, service: name } : { service: name },
        }),
      );
    }
  };
};
