import { logger as mnemonixLogger } from 'mnemonix';
import { env } from '../config/env.js';
const levelPriority = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
};
const configuredLevelPriority = () => {
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
const redactString = (value) => value
    .replace(/(mongodb(?:\+srv)?:\/\/)([^\s/@]+)@/gi, '$1[REDACTED]@')
    .replace(/([?&](?:token|password|secret|api[_-]?key|authorization)=)[^&#\s]*/gi, '$1[REDACTED]');
const sanitize = (value, depth = 0) => {
    if (depth > 5)
        return '[TRUNCATED]';
    if (value === undefined)
        return undefined;
    if (value instanceof Error) {
        return {
            name: value.name,
            message: redactString(value.message),
            stack: value.stack ? redactString(value.stack) : undefined,
        };
    }
    if (typeof value === 'string')
        return redactString(value);
    if (typeof value === 'number' || typeof value === 'boolean' || value === null)
        return value;
    if (Array.isArray(value))
        return value.slice(0, 50).map((item) => sanitize(item, depth + 1));
    if (typeof value !== 'object')
        return String(value);
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
        key,
        sensitiveKey.test(key) ? '[REDACTED]' : sanitize(item, depth + 1),
    ]));
};
const shouldLog = (level) => levelPriority[level] >= configuredLevelPriority();
const writeLog = (level, message, metadata) => {
    if (!shouldLog(level))
        return;
    const safeMetadata = metadata === undefined ? undefined : sanitize(metadata);
    mnemonixLogger[level](`[microserver-api] ${redactString(message)}`, safeMetadata);
};
/**
 * Application logger backed by Mnemonix. Metadata is redacted before it reaches
 * stdout so request bodies, credentials, cookies, and database URIs stay out of logs.
 */
export const logger = {
    debug: (message, metadata) => writeLog('debug', message, metadata),
    info: (message, metadata) => writeLog('info', message, metadata),
    warn: (message, metadata) => writeLog('warn', message, metadata),
    error: (message, metadata) => writeLog('error', message, metadata),
};
//# sourceMappingURL=logger.js.map