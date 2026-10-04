import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../shared/errors/AppError.js';
import { ERROR_CODES } from '../shared/errors/errorCodes.js';
import { UserRole } from '../config/constants.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  employeeId?: string;
  department?: string;
  phone?: string;
  name: string;
  role: UserRole;
  organizationId: string;
  organizationName?: string;
  avatarUrl?: string;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      organizationId?: string;
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  const cookieToken = req.cookies?.accessToken as string | undefined;
  const tokens = [...new Set([bearerToken, cookieToken].filter((token): token is string => Boolean(token)))];

  if (tokens.length === 0) {
    next(AppError.unauthorized('Authentication token missing'));
    return;
  }

  let tokenExpired = false;
  let invalidToken = false;
  for (const token of tokens) {
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthenticatedUser;
      if (!decoded.id || !decoded.organizationId) {
        invalidToken = true;
        continue;
      }

      req.user = decoded;
      req.organizationId = decoded.organizationId;

      import('../shared/context/asyncContext.js').then(({ updateRequestContext }) => {
        updateRequestContext({
          organizationId: decoded.organizationId,
          userId: decoded.id,
          userRole: decoded.role,
        });
      }).catch(() => {});

      next();
      return;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        tokenExpired = true;
      } else if (error instanceof jwt.JsonWebTokenError) {
        invalidToken = true;
      } else {
        next(error);
        return;
      }
    }
  }

  if (tokenExpired) {
    next(new AppError('Access token has expired', 401, ERROR_CODES.TOKEN_EXPIRED));
  } else if (invalidToken) {
    next(new AppError('Invalid authentication token', 401, ERROR_CODES.UNAUTHORIZED));
  } else {
    next(AppError.unauthorized('Authentication token missing'));
  }
}

export { authMiddleware as authenticate };
