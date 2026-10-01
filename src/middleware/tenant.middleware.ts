import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors/AppError.js';
import { ERROR_CODES } from '../shared/errors/errorCodes.js';
import { USER_ROLES } from '../config/constants.js';


export function tenantMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user || !req.organizationId) {
    return next(AppError.unauthorized('Tenant context missing from authenticated session'));
  }

  // Super Admin has global platform clearance across all tenant workspaces
  if (req.user.role === USER_ROLES.SUPER_ADMIN) {
    if (req.headers['x-target-organization-id']) {
      req.organizationId = String(req.headers['x-target-organization-id']);
    } else if (req.query?.organizationId) {
      req.organizationId = String(req.query.organizationId);
    } else if (req.body?.organizationId) {
      req.organizationId = String(req.body.organizationId);
    }
    return next();
  }

  // Security Rule for non-super-admin: Reject if client attempts to override organizationId in query or body
  const bodyOrg = req.body?.organizationId;
  const queryOrg = req.query?.organizationId;

  if ((bodyOrg && bodyOrg !== req.organizationId) || (queryOrg && queryOrg !== req.organizationId)) {
    return next(
      new AppError(
        'Cross-tenant access prohibited. organizationId cannot be overridden by client parameters.',
        403,
        ERROR_CODES.TENANT_MISMATCH
      )
    );
  }

  next();
}
