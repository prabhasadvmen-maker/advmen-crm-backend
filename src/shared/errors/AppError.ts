import { ErrorCode, ERROR_CODES } from './errorCodes.js';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: ErrorCode = ERROR_CODES.INTERNAL_SERVER_ERROR,
    details?: unknown,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(message, 400, ERROR_CODES.BAD_REQUEST, details);
  }

  static validation(message: string, details?: unknown): AppError {
    return new AppError(message, 422, ERROR_CODES.VALIDATION_ERROR, details);
  }

  static unauthorized(message: string = 'Authentication required', code: ErrorCode = ERROR_CODES.UNAUTHORIZED): AppError {
    return new AppError(message, 401, code);
  }

  static forbidden(message: string = 'Permission denied', code: ErrorCode = ERROR_CODES.FORBIDDEN): AppError {
    return new AppError(message, 403, code);
  }

  static notFound(resource: string = 'Resource'): AppError {
    return new AppError(`${resource} not found`, 404, ERROR_CODES.RESOURCE_NOT_FOUND);
  }

  static conflict(message: string, details?: unknown): AppError {
    return new AppError(message, 409, ERROR_CODES.DUPLICATE_RESOURCE, details);
  }

  static rateLimit(message: string = 'Rate limit exceeded, please try again later'): AppError {
    return new AppError(message, 429, ERROR_CODES.RATE_LIMIT_EXCEEDED);
  }

  static circuitOpen(serviceName: string): AppError {
    return new AppError(`Integration service for ${serviceName} is temporarily unavailable`, 503, ERROR_CODES.CIRCUIT_BREAKER_OPEN);
  }

  static internal(message: string = 'An unexpected internal error occurred'): AppError {
    return new AppError(message, 500, ERROR_CODES.INTERNAL_SERVER_ERROR, undefined, false);
  }
}
