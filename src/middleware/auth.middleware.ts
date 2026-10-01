import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../shared/errors/AppError.js';
import { ERROR_CODES } from '../shared/errors/errorCodes.js';
import { UserRole } from '../config/constants.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
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
  try {
    let token: string | undefined;

    // 1. Check Authorization Bearer Header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies?.accessToken) {
      // 2. Check HTTP-only cookie
      token = req.cookies.accessToken;
    }

    if (!token) {
      throw AppError.unauthorized('Authentication token missing');
    }

    // 3. Verify JWT
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthenticatedUser;
    
    if (!decoded.id || !decoded.organizationId) {
      throw AppError.unauthorized('Invalid token payload', ERROR_CODES.UNAUTHORIZED);
    }

    req.user = decoded;
    req.organizationId = decoded.organizationId;

    // Enrich AsyncLocalStorage context
    import('../shared/context/asyncContext.js').then(({ updateRequestContext }) => {
      updateRequestContext({
        organizationId: decoded.organizationId,
        userId: decoded.id,
        userRole: decoded.role,
      });
    }).catch(() => {});

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new AppError('Access token has expired', 401, ERROR_CODES.TOKEN_EXPIRED));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid authentication token', 401, ERROR_CODES.UNAUTHORIZED));
    } else {
      next(error);
    }
  }
}

// Alias export taaki attendance.routes.ts ya baaki routes bina import badle kaam kar sakein
export { authMiddleware as authenticate };