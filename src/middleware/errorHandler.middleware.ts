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
  const statusCode = isAppError ? err.statusCode : 500;
  const errorCode = isAppError ? err.code : 'INTERNAL_SERVER_ERROR';
  const message = isAppError || env.NODE_ENV !== 'production' ? err.message : 'An unexpected internal error occurred';
  const details = isAppError ? err.details : undefined;

  // Log error with correlation context
  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}: ${err.message}`, err, {
    requestId: req.id,
    organizationId: req.organizationId,
    userId: req.user?.id,
    path: req.originalUrl,
  });

  ApiResponse.error(res, message, statusCode, errorCode, details);
}
