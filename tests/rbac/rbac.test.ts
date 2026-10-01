import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { requirePermission, requireAnyPermission } from '../../src/middleware/permission.middleware.js';
import { USER_ROLES } from '../../src/config/constants.js';

describe('RBAC & Permission Middleware Suite', () => {
  let mockReq: any;
  let mockRes: any;
  let nextFn: jest.Mock;

  beforeEach(() => {
    mockReq = {
      user: null,
    };
    mockRes = {};
    nextFn = jest.fn();
  });

  it('rejects unauthorized requests with no authenticated user', () => {
    const middleware = requirePermission('lead.view' as any);
    middleware(mockReq, mockRes, nextFn);

    expect(nextFn).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401 })
    );
  });

  it('permits SUPER_ADMIN role unconditionally', () => {
    mockReq.user = { role: USER_ROLES.SUPER_ADMIN, permissions: [] };
    const middleware = requirePermission('admin.view' as any);
    middleware(mockReq, mockRes, nextFn);

    expect(nextFn).toHaveBeenCalledWith();
  });

  it('permits user when required permission is present in token payload', () => {
    mockReq.user = { role: USER_ROLES.SALES_REP, permissions: ['lead.view', 'lead.create'] };
    const middleware = requirePermission('lead.view' as any);
    middleware(mockReq, mockRes, nextFn);

    expect(nextFn).toHaveBeenCalledWith();
  });

  it('blocks user when required permission is missing and returns 403 Forbidden', () => {
    mockReq.user = { role: USER_ROLES.TELECALLER, permissions: ['call.view'] };
    const middleware = requirePermission('invoice.manage' as any);
    middleware(mockReq, mockRes, nextFn);

    expect(nextFn).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403 })
    );
  });

  it('evaluates requireAnyPermission correctly', () => {
    mockReq.user = { role: USER_ROLES.MARKETING_SDR, permissions: ['campaigns.view'] };
    const middleware = requireAnyPermission('lead.create' as any, 'campaigns.view' as any);
    middleware(mockReq, mockRes, nextFn);

    expect(nextFn).toHaveBeenCalledWith();
  });
});
