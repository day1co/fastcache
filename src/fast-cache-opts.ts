import type { Redis, RedisOptions } from 'ioredis';

export interface FastCacheOpts {
  prefix?: string;
  ttl?: number;
  redis?: RedisOptions;
  createRedisClient?: (RedisOptions?) => Redis;
}
