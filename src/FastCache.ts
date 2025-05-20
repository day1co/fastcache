import { createHash } from 'crypto';
import { Redis, RedisOptions } from 'ioredis';
import IORedis from 'ioredis';
import { LoggerFactory } from '@day1co/pebbles';
import type { Logger } from '@day1co/pebbles';

export interface FastCacheOpts {
  prefix?: string;
  ttl?: number;
  redis?: RedisOptions;
  createRedisClient?: (opts: RedisOptions) => Redis;
}

export interface ListOperations {
  key: string;
  push(value: string): Promise<void>;
  pop(): Promise<string | null>;
  unshift(value: string): Promise<void>;
  shift(): Promise<string | null>;
  setAll(values: Array<string>): Promise<void>;
  getAll(start: number, stop: number): Promise<Array<string | null>>;
  removeAll(start: number, stop: number): Promise<void>;
  length(): Promise<number>;
}

export interface MapOperations {
  key: string;
  set(field: string, value: string): Promise<void>;
  get(field: string): Promise<string | null>;
  remove(field: string): Promise<void>;
  setAll(obj: any): Promise<void>;
  getAll(fields: Array<string>): Promise<Array<string | null>>;
  removeAll(fields: Array<string>): Promise<void>;
  length(): Promise<number>;
}

export interface SetOperations {
  key: string;
  add(...values: Array<string>): Promise<void>;
  remove(...values: Array<string>): Promise<void>;
  contains(value: string): Promise<boolean>;
  length(): Promise<number>;
}

export interface SortedSetOperations {
  key: string;
  add(score: number, value: string): Promise<void>;
  addAll(entries: Array<{ score: number; value: string }>): Promise<void>;
  remove(...values: Array<string>): Promise<void>;
  range({
    start,
    stop,
    withScores,
    reverse,
  }: {
    start: number;
    stop: number;
    withScores?: boolean;
    reverse?: boolean;
  }): Promise<Array<string | { score: number; value: string }>>;
  rangeByScore({
    min,
    max,
    withScores,
    reverse,
  }: {
    min: number;
    max: number;
    withScores?: boolean;
    reverse?: boolean;
  }): Promise<Array<string | { score: number; value: string }>>;
  score(value: string): Promise<number | null>;
  length(): Promise<number>;
  clear(): Promise<void>;
  replaceAll(entries: Array<{ score: number; value: string }>): Promise<void>;
}

// todo: rename fastCache to redisCache
export class FastCache {
  static create(opts?: FastCacheOpts): FastCache {
    return new FastCache(opts);
  }

  private client: Redis;
  private prefix: string;
  private ttl: number;
  private logger: Logger;

  private constructor(opts?: FastCacheOpts) {
    this.logger = LoggerFactory.getLogger('fastcache');
    this.logger.debug('opts: %o', opts);
    this.client = opts?.createRedisClient ? opts?.createRedisClient(opts?.redis ?? {}) : new IORedis(opts?.redis ?? {});
    this.logger.debug(`connected redis: ${opts?.redis?.host}:${opts?.redis?.port}/${opts?.redis?.db}`);
    this.prefix = opts?.prefix ?? '';
    this.ttl = opts?.ttl ?? 60 * 5; // 5min
  }

  public destroy() {
    this.logger.debug('destroy');
    this.client.disconnect();
  }

  //---------------------------------------------------------

  public async set(key: string, value: string, ex?: number): Promise<void> {
    await this.client.set(key, value, 'EX', ex ?? this.ttl);
  }

  public async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  public async remove(key: string): Promise<void> {
    await this.client.del(key);
  }

  public async setAll(obj: Record<string, unknown>): Promise<void> {
    // mset doesn't support expire!
    // return mset(obj);
    const multi = this.client.multi();
    for (const [key, value] of Object.entries(obj)) {
      multi.set(key, value as string, 'EX', this.ttl);
    }
    await multi.exec();
  }

  public async getAll(keys: Array<string>): Promise<Array<string | null>> {
    return this.client.mget(keys);
  }

  public async removeAll(keys: Array<string>): Promise<void> {
    await this.client.del(keys);
  }

  public async flush(pattern: string): Promise<void> {
    if (pattern === '*******') {
      await this.client.flushdb('ASYNC');
      return;
    }

    let cursor = '0';
    let keys: string[] = [];

    do {
      [cursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', '50');

      if (keys && keys.length) {
        await this.client.unlink(keys);
      }
    } while (cursor !== '0');
  }

  //---------------------------------------------------------
  // list

  public list(key: string): ListOperations {
    return {
      key,
      push: async (value: string): Promise<void> => {
        await this.client.rpush(key, value);
      },
      pop: async (): Promise<string | null> => this.client.rpop(key),
      unshift: async (value: string): Promise<void> => {
        await this.client.lpush(key, value);
      },
      shift: async (): Promise<string | null> => this.client.lpop(key),
      setAll: async (values: Array<string>): Promise<void> => {
        await this.client.lpush(key, ...values);
      },
      getAll: async (start = 0, stop = -1): Promise<Array<string | null>> => this.client.lrange(key, start, stop),
      removeAll: async (start = -1, stop = 0): Promise<void> => {
        await this.client.ltrim(key, start, stop);
      },
      length: async (): Promise<number> => this.client.llen(key),
    };
  }

  //---------------------------------------------------------
  // map

  map(key: string): MapOperations {
    return {
      key,
      set: async (field: string, value: string): Promise<void> => {
        await this.client.hset(key, field, value);
      },
      get: async (field: string): Promise<string | null> => this.client.hget(key, field),
      remove: async (field: string): Promise<void> => {
        await this.client.hdel(key, field);
      },
      setAll: async (obj: any): Promise<void> => {
        await this.client.hmset(key, obj);
      },
      getAll: async (fields: Array<string>): Promise<Array<string | null>> => this.client.hmget(key, ...fields),
      removeAll: async (fields: Array<string>): Promise<void> => {
        await this.client.hdel(key, ...fields);
      },
      length: (): Promise<number> => this.client.hlen(key),
    };
  }

  //---------------------------------------------------------

  setOf(key: string): SetOperations {
    return {
      key,
      add: async (...values: Array<string>) => {
        await this.client.sadd(key, ...values);
      },
      remove: async (...values: Array<string>) => {
        await this.client.srem(key, ...values);
      },
      contains: async (value: string): Promise<boolean> => (await this.client.sismember(key, value)) === 1,
      length: async (): Promise<number> => this.client.scard(key),
    };
  }

  sortedSet(key: string): SortedSetOperations {
    return {
      key,
      add: async (score: number, value: string): Promise<void> => {
        await this.client.zadd(key, score, value);
      },
      addAll: async (entries: Array<{ score: number; value: string }>): Promise<void> => {
        if (entries.length === 0) {
          return;
        }

        const args = entries.flatMap((entry) => [entry.score, entry.value]);
        await this.client.zadd(key, ...args);
      },
      remove: async (...values: Array<string>): Promise<void> => {
        await this.client.zrem(key, ...values);
      },
      range: async ({
        start,
        stop,
        withScores = false,
        reverse = false,
      }: {
        start: number;
        stop: number;
        withScores?: boolean;
        reverse?: boolean;
      }): Promise<Array<string | { score: number; value: string }>> => {
        const method = reverse ? 'zrevrange' : 'zrange';
        const result = withScores
          ? await this.client[method](key, start, stop, 'WITHSCORES')
          : await this.client[method](key, start, stop);

        if (!withScores) {
          return result;
        }

        const entries: Array<{ score: number; value: string }> = [];
        for (let i = 0; i < result.length; i += 2) {
          entries.push({
            value: result[i],
            score: parseFloat(result[i + 1]),
          });
        }
        return entries;
      },
      rangeByScore: async ({
        min,
        max,
        withScores = false,
        reverse = false,
      }: {
        min: number;
        max: number;
        withScores?: boolean;
        reverse?: boolean;
      }): Promise<Array<string | { score: number; value: string }>> => {
        const method = reverse ? 'zrevrangebyscore' : 'zrangebyscore';
        const result = withScores
          ? await this.client[method](key, min, max, 'WITHSCORES')
          : await this.client[method](key, min, max);

        if (!withScores) {
          return result;
        }

        const entries: Array<{ score: number; value: string }> = [];
        for (let i = 0; i < result.length; i += 2) {
          entries.push({
            value: result[i],
            score: parseFloat(result[i + 1]),
          });
        }
        return entries;
      },
      score: async (value: string): Promise<number | null> => {
        const score = await this.client.zscore(key, value);
        return score !== null ? parseFloat(score) : null;
      },
      length: async (): Promise<number> => this.client.zcard(key),
      clear: async (): Promise<void> => {
        await this.client.del(key);
      },
      replaceAll: async (entries: Array<{ score: number; value: string }>): Promise<void> => {
        if (entries.length === 0) {
          await this.client.del(key);
          return;
        }

        if (entries.some((entry) => typeof entry.score !== 'number')) {
          throw new Error('score is not a number');
        }

        const tempKey = `${key}:temp:${Date.now()}`;

        const args = entries.flatMap((entry) => [entry.score, entry.value]);
        await this.client.zadd(tempKey, ...args);
        await this.client.expire(tempKey, 60);
        await this.client.rename(tempKey, key);
      },
    };
  }

  //---------------------------------------------------------

  public async withCache(key: string, executor: () => Promise<unknown>): Promise<unknown> {
    const cached = await this.get(key);
    if (cached) {
      return this.deserialize(cached);
    }
    return executor()
      .then((result) => {
        setImmediate(() =>
          this.set(key, this.serialize(result))
            .then(() => this.logger.debug('key set ok: %s', key))
            .catch((err) => this.logger.error('set error: %o', err))
        );
        return result;
      })
      .catch((err) => {
        setImmediate(() =>
          this.remove(key)
            .then(() => this.logger.debug('key removed ok: %s', key))
            .catch((err) => this.logger.error('set error: %o', err))
        );
        throw err;
      });
  }

  //---------------------------------------------------------

  public cacheKey(o: any) {
    return createHash('sha1').update(this.serialize(o)).digest('base64');
  }

  private serialize(o: any): string {
    try {
      return JSON.stringify(o);
    } catch (e) {
      // TODO: better error handling
      return '';
    }
  }

  private deserialize(s: string): any {
    try {
      return JSON.parse(s);
    } catch (e) {
      // TODO: better error handling
      return null;
    }
  }
}
