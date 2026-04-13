import Redis from 'ioredis';
import { config } from './index';
import { logger } from './logger';

export const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: null, // required by BullMQ
  enableReadyCheck: false,
  retryStrategy(times) {
    if (times > 10) {
      logger.warn('Redis: max retries reached, backing off to 30s intervals');
      return 30000; // retry every 30s instead of giving up (null crashes ioredis)
    }
    return Math.min(times * 500, 5000); // 500ms, 1s, 1.5s ... max 5s
  },
  lazyConnect: true, // don't connect until first command — prevents startup crash
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('error', (err) => {
  logger.error({ err }, 'Redis connection error');
});
