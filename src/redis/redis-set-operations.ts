import { Redis } from 'ioredis';

import { SetOperations } from '../set-operations';

export class RedisSetOperations implements SetOperations {
  constructor(readonly redis: Redis, readonly key: string) {}
  async add(...values: Array<string>) {
    return this.redis.sadd(this.key, ...values) as unknown as Promise<void>;
  }
  async remove(...values: Array<string>) {
    return this.redis.srem(this.key, ...values) as unknown as Promise<void>;
  }
  async contains(value: string): Promise<boolean> {
    return (await this.redis.sismember(this.key, value)) === 1;
  }
  async length(): Promise<number> {
    return this.redis.scard(this.key);
  }
}
