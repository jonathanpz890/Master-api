import pino from 'pino';

import { env } from '../config/env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'microserver-api' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.token',
      'req.body.refreshToken',
    ],
    censor: '[REDACTED]',
  },
});
