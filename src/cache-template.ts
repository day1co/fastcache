export interface CacheTemplate {
  execute<T = unknown>(key: string, executor: Promise<T>): Promise<T>;
}
