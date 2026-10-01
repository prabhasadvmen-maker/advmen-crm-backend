import { Response } from 'express';
import { ErrorCode } from '../errors/errorCodes.js';

export interface PaginationMeta {
  requestId?: string;
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  hasNextPage?: boolean;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: ErrorCode | string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export class ApiResponse {
  static success<T>(
    res: Response,
    data: T,
    statusCode: number = 200,
    meta?: PaginationMeta,
    message?: string
  ): Response {
    const requestId = (res.req as { id?: string })?.id;
    const responsePayload: ApiSuccessResponse<T> = {
      success: true,
      data,
      ...(meta || requestId ? { meta: { requestId, ...meta } } : {}),
      ...(message ? { message } : {}),
    };

    return res.status(statusCode).json(responsePayload);
  }

  static created<T>(res: Response, data: T, message?: string): Response {
    return this.success(res, data, 201, undefined, message);
  }

  static paginated<T>(
    res: Response,
    data: T[],
    total: number,
    page: number,
    limit: number,
    message?: string
  ): Response {
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;

    return this.success(
      res,
      data,
      200,
      {
        page,
        limit,
        total,
        totalPages,
        hasNextPage,
      },
      message
    );
  }

  static error(
    res: Response,
    message: string,
    statusCode: number = 500,
    code: ErrorCode | string = 'INTERNAL_SERVER_ERROR',
    details?: unknown
  ): Response {
    const requestId = (res.req as { id?: string })?.id;
    const errorPayload: ApiErrorResponse = {
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
        ...(requestId ? { requestId } : {}),
      },
    };

    return res.status(statusCode).json(errorPayload);
  }
}
