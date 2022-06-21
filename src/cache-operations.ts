import { ListOperations } from './list-operations';
import { MapOperations } from './map-operations';
import { SetOperations } from './set-operations';

export interface CacheOperations {
  init();
  destroy();

  set(key: string, value: string, ttl?: number): Promise<void>;
  get(key: string): Promise<string | null>;
  remove(key: string): Promise<void>;
  setAll(obj: Record<string, string>, ttl?: number): Promise<void>;
  getAll(keys: Array<string>): Promise<Array<string | null>>;
  removeAll(keys: Array<string>): Promise<void>;

  flush(pattern?: string): Promise<void>;

  listOf(key: string): ListOperations;
  mapOf(key: string): MapOperations;
  setOf(key: string): SetOperations;
}
