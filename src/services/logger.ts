import { Logtail } from '@logtail/browser';
import { isLocalMode } from '../config/mode';

const token = process.env.EXPO_PUBLIC_BETTERSTACK_SOURCE_TOKEN;

const logtail = !isLocalMode && token ? new Logtail(token) : null;

type Context = Record<string, unknown>;

export const logger = {
  info(message: string, context?: Context): void {
    if (logtail) {
      logtail.info(message, context);
    } else {
      console.log(`[info] ${message}`, context ?? '');
    }
  },

  error(message: string, error?: unknown, context?: Context): void {
    const errorContext =
      error instanceof Error
        ? { error: { message: error.message, stack: error.stack }, ...context }
        : { error, ...context };

    if (logtail) {
      logtail.error(message, errorContext);
    } else {
      console.error(`[error] ${message}`, errorContext);
    }
  },
};
