import { logger as mnemonixLogger } from 'mnemonix';

import { env } from '../config/env.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogMetadata = Record<string, unknown> | Error | unknown;

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const configuredLevelPriority = (): number => {
  switch (env.LOG_LEVEL) {
    case 'silent':
      return Number.POSITIVE_INFINITY;
    case 'fatal':
      return levelPriority.error;
    case 'trace':
      return levelPriority.debug;
    default:
      return levelPriority[env.LOG_LEVEL];
  }
};

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
  if (value === undefined) return undefined;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      stack: value.stack ? redactString(value.stack) : undefined,
    };
  }
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitize(item, depth + 1));
  if (typeof value !== 'object') return String(value);

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      sensitiveKey.test(key) ? '[REDACTED]' : sanitize(item, depth + 1),
    ]),
  );
};

const shouldLog = (level: LogLevel): boolean => levelPriority[level] >= configuredLevelPriority();

const writeLog = (level: LogLevel, message: string, metadata?: LogMetadata): void => {
  if (!shouldLog(level)) return;
  const safeMetadata = metadata === undefined ? undefined : sanitize(metadata);
  mnemonixLogger[level](`[microserver-api] ${redactString(message)}`, safeMetadata);
};

/**
 * Application logger backed by Mnemonix. Metadata is redacted before it reaches
 * stdout so request bodies, credentials, cookies, and database URIs stay out of logs.
 */
export const logger = {
  debug: (message: string, metadata?: LogMetadata): void => writeLog('debug', message, metadata),
  info: (message: string, metadata?: LogMetadata): void => writeLog('info', message, metadata),
  warn: (message: string, metadata?: LogMetadata): void => writeLog('warn', message, metadata),
  error: (message: string, metadata?: LogMetadata): void => writeLog('error', message, metadata),
};
