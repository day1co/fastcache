import { Redis } from 'ioredis';

import { SetOperations } from '../set-operations';

export class LocalSetOperations implements SetOperations {
  constructor(readonly key: string, readonly store: Set<string> = new Set<string>()) {}
  async add(...values: Array<string>): Promise<void> {
    for (const value of values) {
      this.store.add(value);
    }
  }
  async remove(...values: Array<string>): Promise<void> {
    for (const value of values) {
      this.store.delete(value);
    }
  }
  async contains(value: string): Promise<boolean> {
    return this.store.has(value);
  }
  async length(): Promise<number> {
    return this.store.size;
  }
}
