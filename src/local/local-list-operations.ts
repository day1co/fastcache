import type { ListOperations } from '../list-operations';

export class LocalListOperations implements ListOperations {
  constructor(readonly key: string, readonly store: Array<string> = []) {}

  async push(value: string): Promise<void> {
    this.store.push(value) as unknown as Promise<void>;
  }
  async pop(): Promise<string | null> {
    return this.store.pop() ?? null;
  }
  async unshift(value: string): Promise<void> {
    this.store.unshift(value);
  }
  async shift(): Promise<string | null> {
    return this.store.shift() ?? null;
  }
  async setAll(values: Array<string>): Promise<void> {
    for (const value of values) {
      this.store.push(value);
    }
  }
  async getAll(start = 0, stop = -1): Promise<Array<string | null>> {
    return this.store.slice(start, stop);
  }
  async removeAll(start = -1, stop = 0): Promise<void> {
    this.store.splice(start, stop - start);
  }
  async length(): Promise<number> {
    return this.store.length;
  }
}
