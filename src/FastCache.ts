import type { CacheKeyBuilder } from './cache-key-builder';
import type { CacheOperations } from './cache-operations';
import type { CacheTemplate } from './cache-template';
import type { FastCacheOpts } from './fast-cache-opts';
import type { ListOperations } from './list-operations';
import type { MapOperations } from './map-operations';
import { BaseCacheKeyBuilder } from './base-cache-key-builder';
import { BaseCacheTemplate } from './base-cache-template';
import { RedisCache } from './redis/redis-cache';

export class FastCache extends RedisCache {
  static create(opts?: FastCacheOpts): FastCache {
    return new FastCache(opts);
  }

  /** @deprecated in favor of CacheOperations.mapOf() */
  public list(key: string): ListOperations {
    return this.listOf(key);
  }

  /** @deprecated in favor of CacheOperations.listOf() */
  public map(key: string): MapOperations {
    return this.mapOf(key);
  }

  /** @deprecated in favor of CacheKeyBuilder.keyOf() */
  public cacheKey(o: any): string {
    return new BaseCacheKeyBuilder().keyOf(o);
  }

  /** @deprecated in favor of CacheTemplate.execute() */
  public async withCache(key: string, executor: Promise<any>): Promise<any> {
    return new BaseCacheTemplate(this).execute(key, executor);
  }
}
