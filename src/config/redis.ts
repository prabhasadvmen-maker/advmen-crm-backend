import { Redis } from 'ioredis';
import { env } from './env.js';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    const isCloudRedis = env.REDIS_HOST !== 'localhost' && env.REDIS_HOST !== '127.0.0.1';

    redisClient = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      tls: isCloudRedis ? { rejectUnauthorized: false } : undefined,
      lazyConnect: true,
      maxRetriesPerRequest: null,
      retryStrategy(times) {
        // Exponential backoff up to 2 seconds
        const delay = Math.min(times * 100, 2000);
        return delay;
      },
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis Client Connected');
    });

    redisClient.on('error', (err) => {
      // Log warning rather than crashing if Redis is not locally active yet
      console.warn('⚠️ Redis Connection Warning (Caching/Queue features will degrade gracefully):', err.message);
    });
  }

  return redisClient;
}

export function isRedisConnected(): boolean {
  return redisClient !== null && redisClient.status === 'ready';
}
