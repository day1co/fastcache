import type { Redis } from 'ioredis';
import type { ListOperations } from '../list-operations';

export class RedisListOperations implements ListOperations {
  constructor(readonly redis: Redis, readonly key: string) {}

  async push(value: string): Promise<void> {
    return this.redis.rpush(this.key, value) as unknown as Promise<void>;
  }
  async pop(): Promise<string | null> {
    return this.redis.rpop(this.key);
  }
  async unshift(value: string): Promise<void> {
    return this.redis.lpush(this.key, value) as unknown as Promise<void>;
  }
  async shift(): Promise<string> {
    return this.redis.lpop(this.key);
  }
  async setAll(values: Array<string>): Promise<void> {
    return this.redis.lpush(this.key, values) as unknown as Promise<void>;
  }
  async getAll(start = 0, stop = -1): Promise<Array<string | null>> {
    return this.redis.lrange(this.key, start, stop);
  }
  async removeAll(start = -1, stop = 0): Promise<void> {
    return this.redis.ltrim(this.key, start, stop) as unknown as Promise<void>;
  }
  async length(): Promise<number> {
    return this.redis.llen(this.key);
  }
}
