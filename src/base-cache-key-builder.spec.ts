import { BaseCacheKeyBuilder } from './base-cache-key-builder';

describe('BaseCacheKeyBuilder', () => {
  describe('keyOf', () => {
    test('should generate same key for same obj', async () => {
      const testee = new BaseKeyGenerator();
      for (let i = 0; i < 1000; i += 1) {
        const x = Math.random();
        const r1 = testee.keyOf({ test: x });
        const r2 = testee.keyOf({ test: x });
        expect(r1).toBe(r2);
      }
    });
  });
});
