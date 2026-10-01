import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { AppError } from '../shared/errors/AppError.js';

interface RequestValidationSchema {
  body?: AnyZodObject;
  query?: AnyZodObject;
  params?: AnyZodObject;
}

export function validateRequest(schemas: RequestValidationSchema) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        req.query = (await schemas.query.parseAsync(req.query)) as never;
      }
      if (schemas.params) {
        req.params = (await schemas.params.parseAsync(req.params)) as never;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorDetails = error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
          code: e.code,
        }));
        next(AppError.validation('Request validation failed', errorDetails));
      } else {
        next(error);
      }
    }
  };
}
