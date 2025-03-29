import { createHash } from 'crypto';
import { Redis, RedisOptions } from 'ioredis';
import IORedis from 'ioredis';

// 간단한 로거 인터페이스 구현
interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

// LoggerFactory 구현 (noop 로거)
class LoggerFactory {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static getLogger(_name: string): Logger {
    return {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      debug(_message: string, ..._args: any[]): void {
        // noop
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      info(_message: string, ..._args: any[]): void {
        // noop
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      warn(_message: string, ..._args: any[]): void {
        // noop
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      error(_message: string, ..._args: any[]): void {
        // noop
      },
    };
  }
}

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

  /**
   * 현재 Redis 연결 상태를 확인합니다.
   * @returns 연결이 활성화되어 있으면 true, 그렇지 않으면 false
   */
  public isConnected(): boolean {
    return this.client.status === 'ready';
  }

  //---------------------------------------------------------

  public async set(key: string, value: string, ex?: number): Promise<void> {
    const fullKey = this.getKeyWithPrefix(key);
    await this.client.set(fullKey, value, 'EX', ex ?? this.ttl);
  }

  public async get(key: string): Promise<string | null> {
    const fullKey = this.getKeyWithPrefix(key);
    return this.client.get(fullKey);
  }

  public async remove(key: string): Promise<void> {
    const fullKey = this.getKeyWithPrefix(key);
    await this.client.del(fullKey);
  }

  public async setAll(obj: Record<string, unknown>): Promise<void> {
    // mset doesn't support expire!
    // return mset(obj);
    const multi = this.client.multi();
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = this.getKeyWithPrefix(key);
      multi.set(fullKey, value as string, 'EX', this.ttl);
    }
    await multi.exec();
  }

  public async getAll(keys: Array<string>): Promise<Array<string | null>> {
    const fullKeys = keys.map((key) => this.getKeyWithPrefix(key));
    return this.client.mget(fullKeys);
  }

  public async removeAll(keys: Array<string>): Promise<void> {
    const fullKeys = keys.map((key) => this.getKeyWithPrefix(key));
    await this.client.del(fullKeys);
  }

  public async flush(pattern: string): Promise<void> {
    const fullPattern = this.getKeyWithPrefix(pattern);

    if (pattern === '*******') {
      await this.client.flushdb('ASYNC');
      return;
    }

    let cursor = '0';
    let keys: string[] = [];

    do {
      [cursor, keys] = await this.client.scan(cursor, 'MATCH', fullPattern, 'COUNT', '50');

      if (keys && keys.length) {
        await this.client.unlink(keys);
      }
    } while (cursor !== '0');
  }

  //---------------------------------------------------------
  // list

  public list(key: string): ListOperations {
    const fullKey = this.getKeyWithPrefix(key);

    return {
      key: fullKey,
      push: async (value: string): Promise<void> => {
        await this.client.rpush(fullKey, value);
      },
      pop: async (): Promise<string | null> => this.client.rpop(fullKey),
      unshift: async (value: string): Promise<void> => {
        await this.client.lpush(fullKey, value);
      },
      shift: async (): Promise<string | null> => this.client.lpop(fullKey),
      setAll: async (values: Array<string>): Promise<void> => {
        await this.client.lpush(fullKey, ...values);
      },
      getAll: async (start = 0, stop = -1): Promise<Array<string | null>> => this.client.lrange(fullKey, start, stop),
      removeAll: async (start = -1, stop = 0): Promise<void> => {
        await this.client.ltrim(fullKey, start, stop);
      },
      length: async (): Promise<number> => this.client.llen(fullKey),
    };
  }

  //---------------------------------------------------------
  // map

  map(key: string): MapOperations {
    const fullKey = this.getKeyWithPrefix(key);

    return {
      key: fullKey,
      set: async (field: string, value: string): Promise<void> => {
        await this.client.hset(fullKey, field, value);
      },
      get: async (field: string): Promise<string | null> => this.client.hget(fullKey, field),
      remove: async (field: string): Promise<void> => {
        await this.client.hdel(fullKey, field);
      },
      setAll: async (obj: any): Promise<void> => {
        await this.client.hmset(fullKey, obj);
      },
      getAll: async (fields: Array<string>): Promise<Array<string | null>> => this.client.hmget(fullKey, ...fields),
      removeAll: async (fields: Array<string>): Promise<void> => {
        await this.client.hdel(fullKey, ...fields);
      },
      length: (): Promise<number> => this.client.hlen(fullKey),
    };
  }

  //---------------------------------------------------------

  setOf(key: string): SetOperations {
    const fullKey = this.getKeyWithPrefix(key);

    return {
      key: fullKey,
      add: async (...values: Array<string>) => {
        await this.client.sadd(fullKey, ...values);
      },
      remove: async (...values: Array<string>) => {
        await this.client.srem(fullKey, ...values);
      },
      contains: async (value: string): Promise<boolean> => (await this.client.sismember(fullKey, value)) === 1,
      length: async (): Promise<number> => this.client.scard(fullKey),
    };
  }

  //---------------------------------------------------------

  public async withCache(key: string, executor: () => Promise<unknown>): Promise<unknown> {
    const fullKey = this.getKeyWithPrefix(key);
    const cached = await this.client.get(fullKey);

    if (cached) {
      return this.deserialize(cached);
    }
    return executor()
      .then((result) => {
        setImmediate(() =>
          this.client
            .set(fullKey, this.serialize(result), 'EX', this.ttl)
            .then(() => this.logger.debug('key set ok: %s', fullKey))
            .catch((err) => this.logger.error('set error: %o', err))
        );
        return result;
      })
      .catch((err) => {
        setImmediate(() =>
          this.client
            .del(fullKey)
            .then(() => this.logger.debug('key removed ok: %s', fullKey))
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
    } catch (_e) {
      // TODO: better error handling
      return '';
    }
  }

  private deserialize(s: string): any {
    try {
      return JSON.parse(s);
    } catch (_e) {
      // TODO: better error handling
      return null;
    }
  }

  private getKeyWithPrefix(key: string): string {
    return this.prefix ? `${this.prefix}${key}` : key;
  }
}
