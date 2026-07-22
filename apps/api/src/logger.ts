import { pino } from 'pino';
import { config } from './config.js';

export const logger = pino({
  level: config.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'password',
      '*.password',
      '*.passwordHash',
      'sessionID',
    ],
    censor: '[REDACTED]',
  },
  formatters: { level: (label) => ({ level: label }) },
});
