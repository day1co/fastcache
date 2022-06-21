import type { Redis } from 'ioredis';
import type { MapOperations } from '../map-operations';

export class RedisMapOperations implements MapOperations {
  constructor(readonly redis: Redis, readonly key: string) {}
  async set(field: string, value: string): Promise<void> {
    return this.redis.hset(this.key, field, value) as unknown as Promise<void>;
  }
  async get(field: string): Promise<string | null> {
    return this.redis.hget(this.key, field);
  }
  async remove(field: string): Promise<void> {
    return this.redis.hdel(this.key, field) as unknown as Promise<void>;
  }
  async setAll(obj: Record<string, string>): Promise<void> {
    return this.redis.hmset(this.key, obj) as unknown as Promise<void>;
  }
  async getAll(fields: Array<string>): Promise<Array<string | null>> {
    return this.redis.hmget(this.key, fields);
  }
  async removeAll(fields: Array<string>): Promise<void> {
    return this.redis.hdel(this.key, fields) as unknown as Promise<void>;
  }
  async length(): Promise<number> {
    return this.redis.hlen(this.key);
  }
}
