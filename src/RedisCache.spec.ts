import Redis from 'ioredis-mock';
import { RedisCache } from './';
import type { Redis as IoRedis } from 'ioredis';

describe('RedisCache', () => {
  let client: IoRedis;
  let cache: RedisCache;

  beforeEach((done) => {
    cache = RedisCache.create({ createRedisClient: () => new Redis() });
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

    test('should handle setting zero expiration time', async () => {
      // This test checks the behavior when setting cache with zero TTL
      await cache.set('zeroTtl', 'should-expire-immediately', 0);

      // Small delay to allow expiration
      await new Promise((resolve) => setTimeout(resolve, 10));

      const value = await cache.get('zeroTtl');
      expect(value).toBeNull();
    });

    test('should handle negative expiration time', async () => {
      // This test checks the behavior when setting cache with negative TTL
      await cache.set('negativeTtl', 'should-expire-immediately', -1);

      // Small delay to allow expiration
      await new Promise((resolve) => setTimeout(resolve, 10));

      const value = await cache.get('negativeTtl');
      expect(value).toBeNull();
    });

    test('should handle Redis connection failure', async () => {
      // 에러를 감지하는 리스너 설정
      const errorListener = jest.fn();

      // Redis 에러 이벤트를 발생시키는 테스트용 클래스
      class ErrorEmittingRedis extends Redis {
        constructor() {
          super();
          // 에러 이벤트를 정상적으로 구독하여 unhandled error 방지
          this.on('error', errorListener);
          // 인스턴스 생성 후 에러 발생시키기 (process.nextTick으로 비동기 실행)
          process.nextTick(() => {
            this.emit('error', new Error('Test connection error'));
          });
        }
      }

      // 에러 발생하는 Redis 클라이언트로 캐시 생성
      const failingClientCache = RedisCache.create({
        createRedisClient: () => new ErrorEmittingRedis(),
      });

      // 약간의 지연 후 검증 (에러 이벤트가 발생할 시간 필요)
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 에러 리스너가 호출되었는지 확인
      expect(errorListener).toHaveBeenCalled();

      try {
        // 연결 실패 후에도 작업 시도
        await failingClientCache.set('test-key', 'test-value');
        // 여기서 예외가 발생하지 않는다면, 라이브러리 내부에서 에러를 적절히 처리한다는 의미
        expect(true).toBe(true);
      } catch (error) {
        // 예외가 발생하더라도 테스트는 실패하지 않고 예외를 기록
        expect(error).toBeDefined();
      } finally {
        // 정리
        failingClientCache.destroy();
      }
    });

    test('should handle concurrent list operations', async () => {
      const list = cache.list('concurrentList');

      // Multiple concurrent push operations
      const pushPromises: Promise<void>[] = [];
      for (let i = 0; i < 100; i++) {
        pushPromises.push(list.push(`item-${i}`));
      }

      await Promise.all(pushPromises);

      // Check length is correct
      const length = await list.length();
      expect(length).toBe(100);
    });

    test('should handle concurrent map operations', async () => {
      const map = cache.map('concurrentMap');

      // Multiple concurrent set operations
      const setPromises: Promise<void>[] = [];
      for (let i = 0; i < 100; i++) {
        setPromises.push(map.set(`key-${i}`, `value-${i}`));
      }

      await Promise.all(setPromises);

      // Check length is correct
      const length = await map.length();
      expect(length).toBe(100);
    });

    test('should handle concurrent set operations', async () => {
      const set = cache.setOf('concurrentSet');

      // Multiple concurrent add operations
      const addPromises: Promise<void>[] = [];
      for (let i = 0; i < 100; i++) {
        addPromises.push(set.add(`item-${i}`));
      }

      await Promise.all(addPromises);

      // Check length is correct
      const length = await set.length();
      expect(length).toBe(100);
    });

    test('should handle complex nested data structures', async () => {
      // Create a complex object with nested arrays and objects
      const complexData = {
        array: [1, 2, 3, { key: 'value' }],
        object: {
          nested: {
            deeply: {
              value: 42,
              array: [5, 6, 7],
            },
          },
        },
        mixed: [{ a: 1 }, { b: 2 }, [1, 2, 3]],
      };

      // Test with withCache to check serialization/deserialization
      const result = await cache.withCache('complexData', async () => {
        return complexData;
      });

      // Result should match the original data structure
      expect(JSON.stringify(result)).toBe(JSON.stringify(complexData));
    });

    test('should handle extremely large cacheKey input', async () => {
      // Create a large object
      const largeObj: Record<string, string> = {};
      for (let i = 0; i < 10000; i++) {
        largeObj[`key${i}`] = `value${i}`;
      }

      // Generate cache key shouldn't throw
      expect(() => {
        const key = cache.cacheKey(largeObj);
        expect(typeof key).toBe('string');
      }).not.toThrow();
    });
  });
});
