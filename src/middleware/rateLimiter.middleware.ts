import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../shared/errors/AppError.js';

// Simple in-memory token bucket fallback (can connect to Redis when active)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function rateLimiterMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
  const org = req.organizationId || 'anon';
  const key = `${ip}:${org}`;
  const now = Date.now();

  let entry = requestCounts.get(key);

  if (!entry || now > entry.resetTime) {
    entry = {
      count: 1,
      resetTime: now + env.RATE_LIMIT_WINDOW_MS,
    };
    requestCounts.set(key, entry);
    return next();
  }

  entry.count += 1;

  if (entry.count > env.RATE_LIMIT_MAX_REQUESTS) {
    return next(AppError.rateLimit());
  }

  next();
}
