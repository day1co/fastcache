import type { Logger } from '@day1co/pebbles';
import { LoggerFactory } from '@day1co/pebbles';

import type { CacheOperations } from '../cache-operations';
import type { FastCacheOpts } from '../fast-cache-opts';
import { BaseCacheTemplate } from '../base-cache-template';
import { JsonSerializer } from '../json-serializer';
import { ListOperations } from '../list-operations';
import { MapOperations } from '../map-operations';
import { LocalListOperations } from './local-list-operations';
import { LocalMapOperations } from './local-map-operations';
import { LocalSetOperations } from './local-set-operations';
import { SetOperations } from '../set-operations';

type ValueType = string | Array<string> | Map<string, string> | Set<string>;

export class LocalCache implements CacheOperations {
  private store: Map<string, ValueType>;
  private prefix: string;
  private ttl: number;
  private logger: Logger;

  constructor(opts?: FastCacheOpts, store = new Map<string, ValueType>()) {
    this.logger = LoggerFactory.getLogger('fastcache:local');
    this.prefix = opts?.prefix ?? '';
    this.ttl = opts?.ttl ?? 60 * 5; // 5min
    this.init();
    this.store = store;
  }

  public init() {}

  public destroy() {
    this.logger.debug('destroy');
  }

  //---------------------------------------------------------

  public async set(key: string, value: string, ttl: number = this.ttl): Promise<void> {
    this.store.set(key, value);
    // TODO: ttl
  }

  public async get(key: string): Promise<string | null> {
    return (this.store.get(key) as string) ?? null;
  }

  public async remove(key: string): Promise<void> {
    this.store.delete(key);
  }

  public async setAll(obj: Record<string, string>, ttl: number = this.ttl): Promise<void> {
    for (const [key, value] of Object.entries(obj)) {
      this.store.set(key, value);
      // TODO: ttl
    }
  }

  public async getAll(keys: Array<string>): Promise<Array<string | null>> {
    return keys.map((key) => (this.store.get(key) as string) ?? null);
  }

  public async removeAll(keys: Array<string>): Promise<void> {
    for (const key of keys) {
      this.store.delete(key);
    }
  }

  public async flush(pattern = '*'): Promise<void> {
    // TODO: ...
  }

  public listOf(key: string): ListOperations {
    this.store[key] = this.store[key] ?? [];
    return new LocalListOperations(this.store[key]);
  }

  public mapOf(key: string): MapOperations {
    this.store[key] = this.store[key] ?? new Map();
    return new LocalMapOperations(this.store[key]);
  }

  public setOf(key: string): SetOperations {
    this.store[key] = this.store[key] ?? new Set();
    return new LocalSetOperations(this.store[key]);
  }
}
