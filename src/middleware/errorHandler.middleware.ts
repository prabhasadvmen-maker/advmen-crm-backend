import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors/AppError.js';
import { ApiResponse } from '../shared/response/ApiResponse.js';
import { logger } from '../shared/logger/logger.js';
import { ERROR_CODES, ErrorCode } from '../shared/errors/errorCodes.js';

export function errorHandlerMiddleware(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isAppError = err instanceof AppError;
  const isDuplicate = (err as any)?.code === 11000;
  const isValidationError = err.name === 'ValidationError' || (err as any)?.name === 'ZodError';

  let statusCode = isAppError ? err.statusCode : 500;
  let errorCode: ErrorCode | string = isAppError ? err.code : ERROR_CODES.INTERNAL_SERVER_ERROR;
  let message = err.message || 'An unexpected internal error occurred';

  if (isAppError) {
    message = err.message;
  } else if (isDuplicate) {
    statusCode = 409;
    errorCode = ERROR_CODES.DUPLICATE_RESOURCE;
    const keyPattern = (err as any)?.keyPattern ? Object.keys((err as any).keyPattern).join(', ') : '';
    message = keyPattern
      ? `A record with this ${keyPattern} already exists.`
      : 'A record with these unique details (such as Email or Employee ID) already exists.';
  } else if (isValidationError) {
    statusCode = 422;
    errorCode = ERROR_CODES.VALIDATION_ERROR;
    message = err.message;
  } else if (err.name === 'CastError') {
    statusCode = 400;
    errorCode = ERROR_CODES.BAD_REQUEST;
    message = `Invalid data format provided: ${(err as any).value || ''}`;
  } else if (err.message) {
    message = err.message;
  }

  const details = isAppError ? err.details : undefined;

  const reqAny = req as any;
  const logContext = {
    requestId: reqAny.id || req.header('x-request-id'),
    organizationId: reqAny.organizationId,
    userId: reqAny.user?.id,
    path: req.originalUrl,
  };

  if (statusCode >= 500) {
    logger.error(`Unhandled error on ${req.method} ${req.originalUrl}: ${err.message}`, err, logContext);
  } else {
    logger.warn(`Request rejected on ${req.method} ${req.originalUrl}: ${message}`, logContext);
  }

  ApiResponse.error(res, message, statusCode, errorCode, details);
}
