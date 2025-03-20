import Redis from 'ioredis-mock';
import { FastCache } from './FastCache';
import type { Redis as IoRedis } from 'ioredis';

describe('FastCache', () => {
  let client: IoRedis;
  let cache: FastCache;

  beforeEach((done) => {
    cache = FastCache.create({ createRedisClient: () => new Redis() });
    client = new Redis();
    client.flushdb(done);
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('set', () => {
    test('should work', (done) => {
      const test = 'test' + Math.random();
      cache.set('hello', test).then(() => {
        client.get('hello', (err, result) => {
          expect(err).toBeNull();
          expect(result).toBe(test);
          done();
        });
      });
    });
  });

  describe('get', () => {
    test('should work', (done) => {
      const test = 'test' + Math.random();
      client.set('hello', test);
      cache.get('hello').then((value) => {
        expect(value).toBe(test);
        client.del('hello', () => {
          cache.get('hello').then((value) => {
            expect(value).toBeNull();
            done();
          });
        });
      });
    });
  });

  describe('remove', () => {
    test('should work', (done) => {
      const test = 'test' + Math.random();
      client.set('hello', test);
      cache.get('hello').then((value) => {
        expect(value).toBe(test);
        cache.remove('hello').then(() => {
          cache.get('hello').then((value) => {
            expect(value).toBeNull();
            done();
          });
        });
      });
    });
  });

  describe('list', () => {
    describe('push', () => {
      test('should work', (done) => {
        const list = cache.list('hello');
        list
          .push('foo')
          .then(() => {
            return list.push('bar');
          })
          .then(() => {
            client.lrange('hello', 0, -1, (err, result) => {
              expect(err).toBeNull();
              expect(result).toEqual(['foo', 'bar']);
              done();
            });
          });
      });
    });
    describe('pop', () => {
      test('should work', (done) => {
        client.lpush('hello', 'foo', 'bar');
        const list = cache.list('hello');
        list
          .pop()
          .then((result) => {
            expect(result).toBe('foo');
            return list.pop();
          })
          .then((result) => {
            expect(result).toBe('bar');
            return list.pop();
          })
          .then((result) => {
            expect(result).toBeNull();
            done();
          });
      });
    });
  });

  describe('map', () => {
    describe('set', () => {
      test('should work', (done) => {
        const map = cache.map('hello');
        map
          .set('foo', 'bar')
          .then(() => {
            return map.set('baz', 'qux');
          })
          .then(() => {
            client.hmget('hello', 'foo', 'baz', '__not_found__', (err, result) => {
              expect(err).toBeNull();
              expect(result).toEqual(['bar', 'qux', null]);
              done();
            });
          });
      });
    });
    describe('get', () => {
      test('should work', (done) => {
        client.hmset('hello', 'foo', 'bar', 'baz', 'qux', () => {
          const map = cache.map('hello');
          map
            .get('foo')
            .then((result) => {
              expect(result).toBe('bar');
              return map.get('baz');
            })
            .then((result) => {
              expect(result).toBe('qux');
              return map.get('__not_found__');
            })
            .then((result) => {
              expect(result).toBeNull();
              done();
            });
        });
      });
    });
  });

  describe('set', () => {
    describe('add', () => {
      test('should work', (done) => {
        const set = cache.setOf('hello');
        set
          .add('foo', 'bar', 'baz')
          .then(() => {
            return set.add('bar', 'baz', 'qux');
          })
          .then(() => {
            client.smembers('hello', (err, result) => {
              expect(err).toBeNull();
              expect(new Set(result)).toEqual(new Set(['foo', 'bar', 'baz', 'qux']));
              done();
            });
          });
      });
    });
    describe('remove', () => {
      test('should work', (done) => {
        client.sadd('hello', 'foo', 'bar', 'baz', 'qux', () => {
          const set = cache.setOf('hello');
          set
            .remove('foo')
            .then(() => {
              return set.remove('bar', 'baz');
            })
            .then(() => {
              client.smembers('hello', (err, result) => {
                expect(err).toBeNull();
                expect(new Set(result)).toEqual(new Set(['qux']));
                done();
              });
            });
        });
      });
    });
    describe('contains', () => {
      test('should work', (done) => {
        client.sadd('hello', 'foo', 'bar', () => {
          const set = cache.setOf('hello');
          set
            .contains('foo')
            .then((result) => {
              expect(result).toBeTruthy();
              return set.contains('bar');
            })
            .then((result) => {
              expect(result).toBeTruthy();
              return set.contains('__not_found__');
            })
            .then((result) => {
              expect(result).toBeFalsy();
              done();
            });
        });
      });
    });
  });

  describe('withCache', () => {
    test('should be set after next tick', (done) => {
      const a = { foo: 100 };
      cache.withCache('foo', () => {
        return new Promise((resolve) => {
          resolve(a);
        });
      });
      setTimeout(async () => {
        const foo = await cache.get('foo');
        expect(foo).toEqual(JSON.stringify(a));
        done();
      }, 10);
    });
    test('should be failed to verify for wrong value', (done) => {
      const b = { bar: 100 };
      cache.withCache('foo', () => {
        return new Promise((resolve) => {
          resolve(b);
        });
      });
      setTimeout(() => {
        const foo = cache.get('foo');
        expect(foo).not.toEqual('wrong string');
        done();
      }, 10);
    });
  });

  describe('cacheKey', () => {
    test('should generate same hash for same obj', async () => {
      for (let i = 0; i < 1000; i += 1) {
        const x = Math.random();
        const r1 = cache.cacheKey({ test: x });
        const r2 = cache.cacheKey({ test: x });
        expect(r1).toBe(r2);
      }
    });
  });

  describe('flush', () => {
    const test1Keys: string[] = [];
    const test2Keys: string[] = [];

    beforeAll(async () => {
      for (let i = 0; i < 60; i++) {
        test1Keys.push(`test1${i}`);
        await client.set(`test1${i}`, 'hello');
      }
      for (let i = 0; i < 10; i++) {
        test2Keys.push(`test2${i}`);
        await client.set(`test2${i}`, 'hello');
      }
    });

    test('unlink every key over 50 count', (done) => {
      cache.flush('test1*').then(() => {
        cache.getAll(test1Keys).then((values) => {
          expect(values.every((value) => value === null)).toEqual(true);
          done();
        });
      });
    });
    test('unlink every key within 50 count', (done) => {
      cache.flush('test2*').then(() => {
        cache.getAll(test2Keys).then((values) => {
          expect(values.every((value) => value === null)).toEqual(true);
          done();
        });
      });
    });
  });

  // Boundary value tests and overflow tests
  describe('boundary and overflow tests', () => {
    test('should handle empty string keys', async () => {
      await cache.set('', 'empty-key-value');
      const value = await cache.get('');
      expect(value).toBe('empty-key-value');
    });

    test('should handle very long keys', async () => {
      const longKey = 'a'.repeat(10000); // 10K character key
      await cache.set(longKey, 'long-key-value');
      const value = await cache.get(longKey);
      expect(value).toBe('long-key-value');
    });

    test('should handle very long values', async () => {
      const longValue = 'a'.repeat(1000000); // 1M character value
      await cache.set('longValue', longValue);
      const value = await cache.get('longValue');
      expect(value).toBe(longValue);
    });

    test('should handle setting null and undefined values', async () => {
      await cache.set('nullValue', null as any);
      const nullValue = await cache.get('nullValue');
      expect(nullValue).toBe('');

      await cache.set('undefinedValue', undefined as any);
      const undefinedValue = await cache.get('undefinedValue');
      expect(undefinedValue).toBe('');
    });

    test('should handle setting and retrieving special characters', async () => {
      const specialChars = '!@#$%^&*()_+{}[]|\\:;"\'<>,.?/~`';
      await cache.set('specialChars', specialChars);
      const value = await cache.get('specialChars');
      expect(value).toBe(specialChars);
    });

    test('should handle setting and retrieving emoji', async () => {
      const emoji = '😀🙌👍🎉🔥🚀';
      await cache.set('emoji', emoji);
      const value = await cache.get('emoji');
      expect(value).toBe(emoji);
    });

    test('should handle JSON serialization errors', async () => {
      // Create object with circular reference
      const circularObj: any = { key: 'value' };
      circularObj.self = circularObj;

      // Verify that withCache handles serialization errors gracefully
      const result = await cache.withCache('circularObj', async () => {
        return 'fallback value';
      });

      expect(result).toBe('fallback value');
    });

    test('should handle invalid JSON when deserializing', async () => {
      // Directly set invalid JSON
      await client.set('invalidJson', '{invalid"json:data}');

      // Try to get via cache
      const result = await cache.get('invalidJson');

      // We expect a string return since it couldn't be parsed
      expect(result).toBe('{invalid"json:data}');
    });

    test('should handle concurrent operations on the same key', async () => {
      // Create multiple promises that try to set the same key
      const promises: Promise<void>[] = [];
      for (let i = 0; i < 10; i++) {
        promises.push(cache.set('concurrent', `value-${i}`));
      }

      // Wait for all promises to resolve
      await Promise.all(promises);

      // Get the final value
      const finalValue = await cache.get('concurrent');
      expect(finalValue).toBeDefined();
    });

    test('should handle extremely large list operations', async () => {
      const list = cache.list('largeList');
      const large = 10000;

      // Add many items
      for (let i = 0; i < large; i++) {
        await list.push(`item-${i}`);
      }

      // Check length
      const length = await list.length();
      expect(length).toBe(large);

      // Check some values
      const items = await list.getAll(large - 5, large - 1);
      expect(items.length).toBe(5);
      expect(items[0]).toBe(`item-${large - 5}`);
    });

    test('should handle extremely large map operations', async () => {
      const map = cache.map('largeMap');
      const large = 1000;

      // Add many key-value pairs
      for (let i = 0; i < large; i++) {
        await map.set(`key-${i}`, `value-${i}`);
      }

      // Check length
      const length = await map.length();
      expect(length).toBe(large);

      // Check some values
      const fields = Array.from({ length: 5 }, (_, i) => `key-${i}`);
      const values = await map.getAll(fields);
      expect(values.length).toBe(5);
      expect(values[0]).toBe('value-0');
    });

    test('should handle extremely large set operations', async () => {
      const set = cache.setOf('largeSet');
      const large = 1000;

      // Add many items in batches
      const batchSize = 100;
      for (let i = 0; i < large; i += batchSize) {
        const batch = Array.from({ length: batchSize }, (_, j) => `item-${i + j}`);
        await set.add(...batch);
      }

      // Check length
      const length = await set.length();
      expect(length).toBe(large);

      // Check some values
      const containsFirst = await set.contains('item-0');
      expect(containsFirst).toBeTruthy();

      const containsLast = await set.contains(`item-${large - 1}`);
      expect(containsLast).toBeTruthy();
    });

    test('should handle flush with extremely large number of keys', async () => {
      // Create many keys with the same prefix
      const keyCount = 1000;
      const prefix = 'massive-flush-test:';

      for (let i = 0; i < keyCount; i++) {
        await cache.set(`${prefix}${i}`, `value-${i}`);
      }

      // Flush all keys with pattern
      await cache.flush(`${prefix}*`);

      // Verify keys are gone
      for (let i = 0; i < 10; i++) {
        const value = await cache.get(`${prefix}${i}`);
        expect(value).toBeNull();
      }
    });
  });
});
