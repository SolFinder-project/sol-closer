/**
 * Production-safe logger. Debug/info logs only in development or when NEXT_PUBLIC_LOG_LEVEL=debug.
 * Errors are always logged (consider replacing with proper error reporting in prod).
 */
const isDev = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';
const isDebug =
  typeof process !== 'undefined' &&
  (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug' || process.env.NEXT_PUBLIC_DEBUG === 'true');

const allowDebug = isDev || isDebug;

export const logger = {
  debug: (...args: unknown[]) => {
    if (allowDebug) console.log(...args);
  },
  info: (...args: unknown[]) => {
    if (allowDebug) console.info(...args);
  },
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};
