import 'dotenv/config';

import { z } from 'zod';

const booleanFromEnvironment = z.enum(['true', 'false']).transform((value) => value === 'true');

const environmentSchema = z.object({
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  PRINT3D_HUB_API_URL: z.url().default('http://localhost:5001'),
  BYNDER_API_URL: z.url().default('http://localhost:5002'),
  BANGO_API_URL: z.url().default('http://localhost:5003'),
  TRUST_PROXY: booleanFromEnvironment.default(false),
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  console.error('Invalid environment configuration', parsedEnvironment.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsedEnvironment.data,
  corsOrigins: parsedEnvironment.data.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};

export type Environment = typeof env;
