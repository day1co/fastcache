import type { BinaryToTextEncoding } from 'crypto';
import type { CacheKeyBuilder } from './cache-key-builder';
import type { Serializer } from './serializer';
import { JsonSerializer } from './json-serializer';
import { createHash } from 'crypto';

export class BaseCacheKeyBuilder implements CacheKeyBuilder {
  constructor(
    private readonly serializer: Serializer = new JsonSerializer(),
    private readonly algorithm = 'sha1',
    private readonly encoding: BinaryToTextEncoding = 'base64'
  ) {}

  public keyOf<T = unknown>(o: T): string {
    return createHash(this.algorithm).update(this.serializer.serialize(o)).digest(this.encoding);
  }
}
