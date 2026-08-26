import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApp } from './app.js';
import type { Readiness } from './lib/service-readiness.js';

describe('application', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it('allows the public Blueprint site to call Blueprint API routes', async () => {
    const response = await request(createApp())
      .options('/api/v1/blueprint/orders')
      .set('Origin', 'https://3d.blueprint-studios.co.il')
      .set('Access-Control-Request-Method', 'POST');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(
      'https://3d.blueprint-studios.co.il',
    );
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

  it('returns normalized dictionary data from the Free Dictionary API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      word: 'hello',
      entries: [{ language: { code: 'en' }, senses: [{ definition: 'A greeting.' }] }],
      source: { url: 'https://en.wiktionary.org/wiki/hello' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    const response = await request(createApp()).get('/api/v1/langory/dictionary/en/hello');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      word: 'hello',
      entries: [{ language: { code: 'en' }, senses: [{ definition: 'A greeting.' }] }],
      source: { url: 'https://en.wiktionary.org/wiki/hello' },
    });
    expect(fetch).toHaveBeenCalledWith(expect.objectContaining({
      href: 'https://freedictionaryapi.com/api/v1/entries/en/hello?translations=true',
    }));
  });

  it('returns a useful not-found error when a word is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 404 })));

    const response = await request(createApp()).get('/api/v1/langory/dictionary/fr/not-a-word');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('DICTIONARY_ENTRY_NOT_FOUND');
  });
});
