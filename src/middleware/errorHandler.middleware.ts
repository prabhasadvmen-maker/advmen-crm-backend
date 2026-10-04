import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors/AppError.js';
import { ApiResponse } from '../shared/response/ApiResponse.js';
import { logger } from '../shared/logger/logger.js';
import { env } from '../config/env.js';

export function errorHandlerMiddleware(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isAppError = err instanceof AppError;
  const isDuplicate = (err as any)?.code === 11000;
  const isValidationError = err.name === 'ValidationError';

  let statusCode = isAppError ? err.statusCode : 500;
  let errorCode = isAppError ? err.code : 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected internal error occurred';

  if (isAppError) {
    message = err.message;
  } else if (isDuplicate) {
    statusCode = 409;
    errorCode = 'CONFLICT_ERROR';
    message = 'A record with these unique details (such as Email or Employee ID) already exists.';
  } else if (isValidationError) {
    statusCode = 422;
    errorCode = 'VALIDATION_ERROR';
    message = err.message;
  } else if (env.NODE_ENV !== 'production') {
    message = err.message;
  }

  const details = isAppError ? err.details : undefined;

  const logContext = {
    requestId: req.id,
    organizationId: req.organizationId,
    userId: req.user?.id,
    path: req.originalUrl,
  };
  if (statusCode >= 500) {
    logger.error(`Unhandled error on ${req.method} ${req.originalUrl}: ${err.message}`, { stack: err.stack, ...logContext });
  } else {
    logger.warn(`Request rejected on ${req.method} ${req.originalUrl}: ${message}`, logContext);
  }

  ApiResponse.error(res, message, statusCode, errorCode, details);
}
