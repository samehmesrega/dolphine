import Redis from 'ioredis';
import { config } from './index';
import { logger } from './logger';

export const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: null, // required by BullMQ
  enableReadyCheck: false,
  retryStrategy(times) {
    if (times > 10) {
      logger.warn('Redis: max retries reached, giving up reconnection');
      return null; // stop retrying
    }
    return Math.min(times * 500, 5000); // 500ms, 1s, 1.5s ... max 5s
  },
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('error', (err) => {
  logger.error({ err }, 'Redis connection error');
});
