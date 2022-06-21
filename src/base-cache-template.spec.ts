import type { CacheOperations } from './cache-operations';
import { BaseCacheTemplate } from './base-cache-template';

describe('BaseCacheTemplate', () => {
  describe('execute', () => {
    test('should work', async () => {
      const storage = {};
      const cacheOperationsMock = jest.fn(() => ({
        get(key: string) {
          return storage[key];
        },
        set(key: string) {
          stroage[key] = value;
        },
        remove(key: string) {
          delete storage[key];
        },
      })) as unknown as CacheOperations;
      const testee = new BaseCacheTemplate(cacheOperationsMock);
      expect(testee.execute('hello', Promise.resolve('world'))).resolves.toBe('world');
      expect(storage['hello']).toBe('world');
      expect(testee.execute('hello', Promise.reject('error'))).rejects.toBe('error');
    });
  });
});
