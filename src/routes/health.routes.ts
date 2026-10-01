import { Router, Request, Response } from 'express';
import { isDBConnected } from '../config/db.js';
import { isRedisConnected } from '../config/redis.js';
import { ApiResponse } from '../shared/response/ApiResponse.js';

export const healthRouter = Router();

/**
 * Liveness Probe: Verifies the Express server process is running
 */
healthRouter.get('/live', (_req: Request, res: Response) => {
  return ApiResponse.success(res, {
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptimeSeconds: process.uptime(),
  });
});

/**
 * Readiness Probe: Checks that critical dependencies (MongoDB, Redis) are reachable
 */
healthRouter.get('/ready', (_req: Request, res: Response) => {
  const dbStatus = isDBConnected();
  const redisStatus = isRedisConnected();

  const isReady = dbStatus; // MongoDB is mandatory; Redis allows graceful degradation

  const statusData = {
    status: isReady ? 'READY' : 'DEGRADED',
    dependencies: {
      database: dbStatus ? 'CONNECTED' : 'DISCONNECTED',
      redis: redisStatus ? 'CONNECTED' : 'DISCONNECTED',
    },
    timestamp: new Date().toISOString(),
  };

  const statusCode = isReady ? 200 : 503;
  return ApiResponse.success(res, statusData, statusCode);
});
