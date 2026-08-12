import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from './app.js';

describe('application', () => {
  it('reports liveness with a request ID', async () => {
    const response = await request(createApp()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('reports not ready while graceful shutdown is in progress', async () => {
    const response = await request(createApp({ isReady: () => false })).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'not_ready' });
  });

  it('returns a structured error for an unknown route', async () => {
    const response = await request(createApp()).get('/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(response.body.error.requestId).toBeDefined();
  });
});
