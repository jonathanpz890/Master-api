import { logger as mnemonixLogger } from 'mnemonix';

const sensitiveKey = /authorization|cookie|password|secret|token|api[_-]?key|session|credential/i;

const redactString = (value: string): string =>
  value
    .replace(/(mongodb(?:\+srv)?:\/\/)([^\s/@]+)@/gi, '$1[REDACTED]@')
    .replace(
      /([?&](?:token|password|secret|api[_-]?key|authorization)=)[^&#\s]*/gi,
      '$1[REDACTED]',
    );

const sanitize = (value: unknown, depth = 0): unknown => {
  if (depth > 5) return '[TRUNCATED]';
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      stack: value.stack ? redactString(value.stack) : undefined,
    };
  }
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitize(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        sensitiveKey.test(key) ? '[REDACTED]' : sanitize(item, depth + 1),
      ]),
    );
  }
  return value;
};

const write = (
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  metadata?: unknown,
): void => {
  mnemonixLogger[level](
    `[bynder] ${redactString(message)}`,
    metadata === undefined ? undefined : sanitize(metadata),
  );
};

export const logger = {
  debug: (message: string, metadata?: unknown): void => write('debug', message, metadata),
  info: (message: string, metadata?: unknown): void => write('info', message, metadata),
  warn: (message: string, metadata?: unknown): void => write('warn', message, metadata),
  error: (message: string, metadata?: unknown): void => write('error', message, metadata),
};
