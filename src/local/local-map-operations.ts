import type { Redis } from 'ioredis';
import type { MapOperations } from '../map-operations';

export class LocalMapOperations implements MapOperations {
  constructor(readonly key: string, readonly storage: Map<string, string> = new Map<string, string>()) {}
  async set(field: string, value: string): Promise<void> {
    this.storage.set(field, value);
  }
  async get(field: string): Promise<string | null> {
    return this.storage.get(field) ?? null;
  }
  async remove(field: string): Promise<void> {
    this.storage.delete(field);
  }
  async setAll(obj: Record<string, string>): Promise<void> {
    for (const [field, value] of Object.entries(obj)) {
      this.storage.set(field, value);
    }
  }
  async getAll(fields: Array<string>): Promise<Array<string | null>> {
    return fields.map((field) => this.storage.get(field) ?? null);
  }
  async removeAll(fields: Array<string>): Promise<void> {
    for (const field of fields) {
      this.storage.delete(field);
    }
  }
  async length(): Promise<number> {
    return this.storage.size;
  }
}
