export interface CacheKeyBuilder {
  keyOf<T = unknown>(o: T): string;
}
