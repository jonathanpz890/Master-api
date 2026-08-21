import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from './app.js';
import type { Readiness } from './lib/service-readiness.js';

describe('application', () => {
  it('reports liveness with a request ID', async () => {
    const response = await request(createApp()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('shows a human-friendly dashboard at the API root', async () => {
    const response = await request(createApp()).get('/');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('Microserver API');
    expect(response.text).toContain('Health check');
  });

  it('reports not ready while graceful shutdown is in progress', async () => {
    const response = await request(createApp({ isReady: () => false })).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'not_ready' });
  });

  it('reports degraded readiness without blocking healthy service routes', async () => {
    const readiness = () => ({
      ready: false,
      services: {
        print3dHub: { state: 'ready' },
        bynder: { state: 'failed', error: 'Connection refused' },
      },
    }) satisfies Readiness;
    const app = createApp({ getReadiness: readiness });

    const health = await request(app).get('/health/ready');
    const api = await request(app).get('/api/v1');
    const unavailableService = await request(app).get('/api/v1/bynder/recipe');

    expect(health.status).toBe(200);
    expect(health.body).toEqual({ status: 'degraded', services: readiness().services });
    expect(api.status).toBe(200);
    expect(unavailableService.status).toBe(503);
    expect(unavailableService.body.error).toMatchObject({
      code: 'SERVICE_NOT_READY',
      details: { service: 'bynder', state: 'failed' },
    });
  });

  it('returns a structured error for an unknown route', async () => {
    const response = await request(createApp()).get('/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(response.body.error.requestId).toBeDefined();
  });
});
