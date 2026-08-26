import { Router } from 'express';
import { z } from 'zod';

import { AppError } from '../lib/app-error.js';

const dictionaryApiBaseUrl = 'https://freedictionaryapi.com/api/v1/entries';

const lookupParamsSchema = z.object({
  language: z.string().trim().regex(/^[a-z]{2,3}$/i, 'Language must be an ISO 639-1 or 639-3 code.'),
  word: z.string().trim().min(1).max(100),
});

const lookupQuerySchema = z.object({
  translations: z.enum(['true', 'false']).default('true'),
});

export const createLangoryRouter = (): Router => {
  const router = Router();

  router.get('/dictionary/:language/:word', async (request, response, next) => {
    try {
      const { language, word } = lookupParamsSchema.parse(request.params);
      const { translations } = lookupQuerySchema.parse(request.query);
      const url = new URL(`${dictionaryApiBaseUrl}/${encodeURIComponent(language)}/${encodeURIComponent(word)}`);
      url.searchParams.set('translations', translations);

      const upstreamResponse = await fetch(url);
      if (upstreamResponse.status === 404) {
        throw new AppError({
          code: 'DICTIONARY_ENTRY_NOT_FOUND',
          message: `No dictionary entry was found for "${word}".`,
          statusCode: 404,
          details: { language, word },
        });
      }
      if (!upstreamResponse.ok) {
        throw new AppError({
          code: 'DICTIONARY_PROVIDER_ERROR',
          message: 'The dictionary provider is unavailable.',
          statusCode: 502,
          details: { providerStatus: upstreamResponse.status },
        });
      }

      const entry = await upstreamResponse.json() as Record<string, unknown>;
      response.json({
        word: entry.word ?? word,
        entries: entry.entries ?? [],
        source: entry.source,
      });
    } catch (error: unknown) {
      next(error);
    }
  });

  return router;
};