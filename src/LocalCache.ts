import { isFunction, isPromised, LocalCacheConstructor } from './LocalCache.type';

type StorageOpts = {
  hit: number;
};

export class LocalCache {
  private readonly storage: Map<string, unknown>;
  private readonly storageOpts: Map<string, StorageOpts>;
  private readonly ttlInSec: number;
  public totalHit: number;
  public hitCarry: number;

  constructor(opts: LocalCacheConstructor = { ttlInSec: 60 }) {
    this.storage = new Map();
    this.storageOpts = new Map();
    this.ttlInSec = opts.ttlInSec;
    this.hitCarry = 0;
    this.totalHit = 0;
  }

  withCache(key: string, data: unknown) {
    if (this.existCache(key)) {
      return this.getCache(key);
    }

    return this.setCache(key, data);
  }

  existCache(key: string): boolean {
    return this.storage.has(key);
    // another options:
    // return this.storage.has(key) && this.storageOpts.has(key);
    // throw new Error(`no key provided or cache item exist: ${key}`);
  }

  setCache(key: string, data: unknown): void {
    setTimeout(() => {
      this.clearCache(key);
    }, 1000 * this.ttlInSec);

    if (isFunction(data)) {
      const result = data.apply(null);

      if (isPromised(result)) {
        result
          .then((resolved) => {
            this.saveItem(key, resolved);
            return;
          })
          .catch((reason) => {
            console.log(51, reason);
            throw new Error(reason);
          });
      }

      this.saveItem(key, result);
      return;
    }
    this.saveItem(key, data);
  }

  // should go has check before use it.
  // therefore, it uses withCache wrapper commonly
  getCache(key: string): unknown {
    process.nextTick(() => {
      const opts = this.storageOpts.get(key);

      if (opts) {
        opts.hit += 1;
        if (opts.hit >= Number.MAX_VALUE) {
          opts.hit = 0;
        }
        this.storageOpts.set(key, opts);

        this.totalHit += 1;
        if (this.totalHit >= Number.MAX_VALUE) {
          this.totalHit = 0;
          this.hitCarry += 1;
        }
      }
    }, 1);

    // early return
    return this.storage.get(key);
  }

  clearCache(key: string): void {
    this.storage.delete(key);
    this.storageOpts.delete(key);
  }

  private saveItem(key: string, data: unknown) {
    this.storage.set(key, data);
    process.nextTick(() => {
      const opts: StorageOpts = { hit: 0 };
      this.storageOpts.set(key, opts);
    });
  }

  static snip(cache: LocalCache) {
    return {
      hitCount: cache.totalHit,
      carryCount: cache.hitCarry,
      itemCount: cache.storage.size ?? 0,
      itemHitRate: cache.storageOpts.entries(),
    };
  }
}
