import { env } from '../../config/env.js';
import { getRequestContext } from '../context/asyncContext.js';

export interface LogContext {
  requestId?: string;
  organizationId?: string;
  userId?: string;
  module?: string;
  [key: string]: unknown;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private formatLog(level: LogLevel, message: string, context?: LogContext, error?: unknown) {
    const timestamp = new Date().toISOString();
    const reqContext = getRequestContext();

    const mergedContext: Record<string, unknown> = {
      requestId: context?.requestId || reqContext?.requestId,
      organizationId: context?.organizationId || reqContext?.organizationId,
      userId: context?.userId || reqContext?.userId,
      path: reqContext?.path,
      method: reqContext?.method,
      ...context,
    };

    // Clean undefined values from context
    Object.keys(mergedContext).forEach((key) => {
      if (mergedContext[key] === undefined) {
        delete mergedContext[key];
      }
    });

    if (error) {
      if (error instanceof Error) {
        mergedContext.errorName = error.name;
        mergedContext.errorMessage = error.message;
        mergedContext.stack = error.stack;
      } else {
        mergedContext.rawError = error;
      }
    }

    if (env.NODE_ENV === 'production') {
      // Production: Structured NDJSON format
      return JSON.stringify({
        timestamp,
        level: level.toUpperCase(),
        app: env.APP_NAME,
        message,
        ...mergedContext,
      });
    } else {
      // Development: Readable colorized format with structured JSON metadata
      const hasMeta = Object.keys(mergedContext).length > 0;
      const metaStr = hasMeta ? ` ${JSON.stringify(mergedContext)}` : '';
      return `[${timestamp}] [${level.toUpperCase()}] [${env.APP_NAME}] ${message}${metaStr}`;
    }
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatLog('info', message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatLog('warn', message, context));
  }

  error(message: string, error?: unknown, context?: LogContext): void {
    console.error(this.formatLog('error', message, context, error));
  }

  debug(message: string, context?: LogContext): void {
    if (env.NODE_ENV === 'development') {
      console.debug(this.formatLog('debug', message, context));
    }
  }
}

export const logger = new Logger();
