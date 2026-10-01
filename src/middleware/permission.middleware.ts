import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors/AppError.js';
import { PermissionKey, USER_ROLES, ROLE_DEFAULT_PERMISSIONS } from '../config/constants.js';

/**
 * Factory middleware to require one or more permission keys
 */
export function requirePermission(...requiredPermissions: PermissionKey[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      return next(AppError.unauthorized());
    }

    // Super Admin and Org Admin have full administrative clearance over workspace domain actions
    const roleUpper = (user.role || '').toUpperCase().replace('-', '_');
    if (
      user.role === USER_ROLES.SUPER_ADMIN ||
      roleUpper === 'SUPER_ADMIN' ||
      roleUpper === 'SUPERADMIN' ||
      user.role === USER_ROLES.ORG_ADMIN ||
      roleUpper === 'ORG_ADMIN' ||
      roleUpper === 'ADMIN'
    ) {
      return next();
    }

    let userPermissions = user.permissions || [];
    if (userPermissions.length === 0 && ROLE_DEFAULT_PERMISSIONS[user.role]) {
      userPermissions = ROLE_DEFAULT_PERMISSIONS[user.role];
    }

    const hasAll = requiredPermissions.every((perm) => userPermissions.includes(perm));

    if (!hasAll) {
      return next(
        AppError.forbidden(
          `Access denied. Required permission: [${requiredPermissions.join(', ')}]`
        )
      );
    }

    next();
  };
}

/**
 * Require at least one of the provided permissions
 */
export function requireAnyPermission(...permissions: PermissionKey[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      return next(AppError.unauthorized());
    }

    const roleUpper = (user.role || '').toUpperCase().replace('-', '_');
    if (
      user.role === USER_ROLES.SUPER_ADMIN ||
      roleUpper === 'SUPER_ADMIN' ||
      roleUpper === 'SUPERADMIN' ||
      user.role === USER_ROLES.ORG_ADMIN ||
      roleUpper === 'ORG_ADMIN' ||
      roleUpper === 'ADMIN'
    ) {
      return next();
    }

    let userPermissions = user.permissions || [];
    if (userPermissions.length === 0 && ROLE_DEFAULT_PERMISSIONS[user.role]) {
      userPermissions = ROLE_DEFAULT_PERMISSIONS[user.role];
    }

    const hasAny = permissions.some((perm) => userPermissions.includes(perm));

    if (!hasAny) {
      return next(
        AppError.forbidden(
          `Access denied. Requires at least one of: [${permissions.join(', ')}]`
        )
      );
    }

    next();
  };
}
