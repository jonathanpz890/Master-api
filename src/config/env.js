import 'dotenv/config';
import { z } from 'zod';
import { logger } from 'mnemonix';
const booleanFromEnvironment = z.enum(['true', 'false']).transform((value) => value === 'true');
// The public Blueprint storefront is served separately from this API. Keep its
// exact production origin trusted even when a deployment omits CORS_ORIGINS.
const builtInCorsOrigins = [
    'https://3d.blueprint-studios.co.il',
    // Microserver owns port 3000 locally; Bingory's CRA server uses 3001.
    'http://localhost:3001',
];
const environmentSchema = z.object({
    CORS_ORIGINS: z.string().default('http://localhost:3000'),
    HOST: z.string().default('0.0.0.0'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    TRUST_PROXY: booleanFromEnvironment.default(false),
});
const parsedEnvironment = environmentSchema.safeParse(process.env);
if (!parsedEnvironment.success) {
    logger.error('Invalid environment configuration', parsedEnvironment.error.flatten().fieldErrors);
    process.exit(1);
}
export const env = {
    ...parsedEnvironment.data,
    corsOrigins: [...new Set([
            ...builtInCorsOrigins,
            ...parsedEnvironment.data.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
        ])],
};
//# sourceMappingURL=env.js.map