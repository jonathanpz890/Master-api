const { logger: mnemonixLogger } = require('mnemonix');

const redactString = (value) =>
  value
    .replace(/(mongodb(?:\+srv)?:\/\/)([^\s/@]+)@/gi, '$1[REDACTED]@')
    .replace(
      /([?&](?:token|password|secret|api[_-]?key|authorization)=)[^&#\s]*/gi,
      '$1[REDACTED]',
    );

const sanitize = (value, depth = 0) => {
  if (depth > 4) return '[TRUNCATED]';
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
      Object.entries(value).map(([key, item]) => [
        key,
        /password|secret|token|authorization|cookie/i.test(key)
          ? '[REDACTED]'
          : sanitize(item, depth + 1),
      ]),
    );
  }
  return value;
};

const write = (level, message, metadata) =>
  mnemonixLogger[level](
    `[bingory] ${redactString(message)}`,
    metadata === undefined ? undefined : sanitize(metadata),
  );

module.exports = {
  logger: {
    info: (message, metadata) => write('info', message, metadata),
    warn: (message, metadata) => write('warn', message, metadata),
    error: (message, metadata) => write('error', message, metadata),
    debug: (message, metadata) => write('debug', message, metadata),
  },
};
