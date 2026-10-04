import { describe, expect, it, jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../../src/middleware/auth.middleware.js';
import { env } from '../../src/config/env.js';

describe('authMiddleware', () => {
  const payload = {
    id: 'user-1',
    email: 'employee@example.com',
    name: 'Employee',
    role: 'SALES_REP' as const,
    organizationId: 'org-1',
    permissions: ['lead.view'],
  };

  it('authenticates a valid bearer token when no access cookie is present', () => {
    const validBearer = jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: '5m' });
    const req = {
      headers: { authorization: `Bearer ${validBearer}` },
      cookies: {},
    } as any;
    const next = jest.fn();

    authMiddleware(req, {} as any, next);

    expect(req.user.id).toBe(payload.id);
    expect(req.organizationId).toBe(payload.organizationId);
    expect(next).toHaveBeenCalledWith();
  });

  it('uses a valid access cookie when the bearer token has expired', () => {
    const expiredBearer = jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: '-1s' });
    const validCookie = jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: '5m' });
    const req = {
      headers: { authorization: `Bearer ${expiredBearer}` },
      cookies: { accessToken: validCookie },
    } as any;
    const next = jest.fn();

    authMiddleware(req, {} as any, next);

    expect(req.user.id).toBe(payload.id);
    expect(req.organizationId).toBe(payload.organizationId);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects when all supplied access tokens are expired', () => {
    const expiredToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: '-1s' });
    const req = {
      headers: { authorization: `Bearer ${expiredToken}` },
      cookies: {},
    } as any;
    const next = jest.fn();

    authMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Access token has expired',
      statusCode: 401,
    }));
  });
});
