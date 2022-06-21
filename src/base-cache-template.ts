import type { CacheOperations } from './cache-operations';
import type { CacheTemplate } from './cache-template';
import type { Serializer } from './serializer';
import { JsonSerializer } from './json-serializer';

export class BaseCacheTemplate<T> implements CacheTemplate {
  constructor(
    private readonly cache: CacheOperations,
    private readonly serializer: Serializer = new JsonSerializer()
  ) {}

  public async execute<T = unknown>(key: string, executor: Promise<T>): Promise<T> {
    const cached = await this.cache.get(key);
    if (cached) {
      return this.serializer.deserialize(cached)!;
    }
    try {
      const result = await executor;
      setImmediate(async () => await this.cache.set(key, this.serializer.serialize<T>(result)));
      return result;
    } catch (err: unknown) {
      setImmediate(async () => await this.cache.remove(key));
      throw err;
    }
  }
}
