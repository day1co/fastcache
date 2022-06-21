import IORedis from 'ioredis';
import type { Logger } from '@day1co/pebbles';
import { LoggerFactory } from '@day1co/pebbles';
import { Redis, RedisOptions } from 'ioredis';

import type { CacheOperations } from '../cache-operations';
import type { FastCacheOpts } from '../fast-cache-opts';
import { BaseCacheTemplate } from '../base-cache-template';
import { JsonSerializer } from '../json-serializer';
import { ListOperations } from '../list-operations';
import { MapOperations } from '../map-operations';
import { RedisListOperations } from './redis-list-operations';
import { RedisMapOperations } from './redis-map-operations';
import { RedisSetOperations } from './redis-set-operations';
import { SetOperations } from '../set-operations';

export class RedisCache implements CacheOperations {
  private client: Redis;
  private prefix: string;
  private ttl: number;
  private logger: Logger;

  constructor(opts?: FastCacheOpts) {
    this.logger = LoggerFactory.getLogger('fastcache:redis');
    this.client = opts?.createRedisClient ? opts?.createRedisClient(opts?.redis) : new IORedis(opts?.redis);
    this.logger.debug(`connect redis: ${opts?.redis?.host}:${opts?.redis?.port}/${opts?.redis?.db}`);
    this.prefix = opts?.prefix ?? '';
    this.ttl = opts?.ttl ?? 60 * 5; // 5min
    this.init();
  }

  public init() {}

  public destroy() {
    this.logger.debug('destroy');
    this.client.disconnect();
  }

  //---------------------------------------------------------

  public async set(key: string, value: string, ttl: number = this.ttl): Promise<void> {
    return this.client.set(key, value, 'EX', ttl) as unknown as Promise<void>;
  }

  public async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  public async remove(key: string): Promise<void> {
    return this.client.del(key) as unknown as Promise<void>;
  }

  public async setAll(obj: Record<string, string>, ttl: number = this.ttl): Promise<void> {
    // mset doesn't support expire!
    // return mset(obj);
    const multi = this.client.multi();
    for (const [key, value] of Object.entries(obj)) {
      multi.set(key, value as string, 'EX', ttl);
    }
    return multi.exec() as unknown as Promise<void>;
  }

  public async getAll(keys: Array<string>): Promise<Array<string | null>> {
    return this.client.mget(keys);
  }

  public async removeAll(keys: Array<string>): Promise<void> {
    return this.client.del(keys) as unknown as Promise<void>;
  }

  public async flush(pattern = '*'): Promise<void> {
    if (pattern === '*') {
      return this.client.flushdb('async') as unknown as Promise<void>;
    }
    // XXX: partial flush
    let [cursor, keys] = await this.client.scan('0', 'MATCH', pattern, 'COUNT', 50);
    while (cursor !== '0') {
      if (keys && keys.length) {
        await this.client.unlink(keys);
      }
      [cursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 50);
    }
  }

  public listOf(key: string): ListOperations {
    return new RedisListOperations(this.client, key);
  }

  public mapOf(key: string): MapOperations {
    return new RedisMapOperations(this.client, key);
  }

  public setOf(key: string): SetOperations {
    return new RedisSetOperations(this.client, key);
  }

  /** @deprecated in favor of listOf() */
  public list(key: string): ListOperations {
    this.logger.warn('deprecated in favor of listOf()');
    return this.listOf(key);
  }

  /** @deprecated in favor of mapOf() */
  public map(key: string): MapOperations {
    this.logger.warn('deprecated in favor of mapOf()');
    return this.mapOf(key);
  }
}
