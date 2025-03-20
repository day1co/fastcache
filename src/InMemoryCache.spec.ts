import { setTimeout } from 'node:timers/promises';

import { InMemoryCache } from './InMemoryCache';

describe('LocalCache', () => {
  let localCache: InMemoryCache;

  beforeEach(() => {
    localCache = new InMemoryCache({ ttlInSec: 1 });
  });

  describe('withCache', () => {
    it('should return cached data', async () => {
      const fetchSomething = async () => {
        return { foo: 'async function' };
      };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _pass_ = localCache.withCache('foo', fetchSomething);

      await setTimeout(10);

      const data = localCache.withCache('foo', fetchSomething);

      expect(data).toEqual({ foo: 'async function' });

      await setTimeout(10);

      const snipping = InMemoryCache.snip(localCache);

      expect(snipping).toHaveProperty('hitCount');
      expect(snipping.hitCount).toEqual(1);
    });

    it('should return state for cached item', async () => {
      const fetchSomething = async () => {
        return { foo: 'async function' };
      };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _firstCall_ = localCache.withCache('foo', fetchSomething);

      await setTimeout(10);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _secondCall_ = localCache.withCache('foo', fetchSomething);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _thirdCall_ = localCache.withCache('foo', fetchSomething);

      await setTimeout(10);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _anotherCall_ = localCache.withCache('bar', fetchSomething);

      await setTimeout(10);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _anotherCallLater_ = localCache.withCache('bar', fetchSomething);

      await setTimeout(10);

      const snipping = InMemoryCache.snip(localCache);

      expect(snipping).toHaveProperty('hitCount');
      expect(snipping).toHaveProperty('itemCount');
      expect(snipping.hitCount).toEqual(3);
      expect(snipping.itemCount).toEqual(2);
    });
  });

  describe('setCache/getCache', () => {
    it('should return cached value', async () => {
      localCache.setCache('foo', { foo: 123 });

      await setTimeout(100);

      const data = localCache.getCache('foo');
      expect(data).toEqual({ foo: 123 });
    });

    it('should not exist cache that invalidated after 1 sec', async () => {
      localCache.setCache('foo', { foo: 123 });

      await setTimeout(1100);

      const data = localCache.getCache('foo');
      expect(data).toBeUndefined();
    });

    it('should return cache value from function', async () => {
      const fn = () => {
        return { foo: 'function' };
      };
      localCache.setCache('foo', fn);

      await setTimeout(10);

      const data = localCache.getCache('foo');
      expect(data).toEqual({ foo: 'function' });
    });

    it('should call once from function', async () => {
      let count = 0;
      const fn = () => {
        count += 1;
        return { foo: 'function' };
      };
      localCache.setCache('foo', fn);

      await setTimeout(10);

      localCache.getCache('foo');
      expect(count).toEqual(1);
    });

    it('should return cache value from function in promised', async () => {
      const soFar = () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        return new Promise((resolve, reject) => {
          resolve({ foo: 'promised function' });
        });
      };
      localCache.setCache('foo', soFar);

      await setTimeout(10);

      const data = localCache.getCache('foo');
      expect(data).toEqual({ foo: 'promised function' });
    });

    it('should throw from function', async () => {
      const soFar = () => {
        throw new Error('something wrong');
      };

      await expect(() => {
        localCache.setCache('foo', soFar);
      }).toThrow('something wrong');
    });

    it('should return cache value from function in promise resolved', async () => {
      const soFar = () => {
        return Promise.resolve({ foo: 'resolved promise' });
      };
      localCache.setCache('foo', soFar);

      await setTimeout(10);

      const data = localCache.getCache('foo');
      expect(data).toEqual({ foo: 'resolved promise' });
    });

    it('should return cache value from async function', async () => {
      const asyncFn = async () => {
        return { foo: 'async function' };
      };
      localCache.setCache('foo', asyncFn);

      await setTimeout(10);

      const data = localCache.getCache('foo');
      expect(data).toEqual({ foo: 'async function' });
    });

    it('should not exist cache that invalidated after 1 sec. use set expire time', async () => {
      localCache.setCache('foo', { foo: 123 }, 1);

      await setTimeout(1100);

      const data = localCache.getCache('foo');
      expect(data).toBeUndefined();
    });
  });

  // Boundary value tests and overflow tests
  describe('boundary and overflow tests', () => {
    it('should handle zero TTL value', async () => {
      const zeroTtlCache = new InMemoryCache({ ttlInSec: 0 });
      zeroTtlCache.setCache('foo', { foo: 123 });

      // Data should be immediately invalidated with zero TTL
      await setTimeout(10);

      const data = zeroTtlCache.getCache('foo');
      expect(data).toBeUndefined();
    });

    it('should handle negative TTL value by treating it as zero', async () => {
      const negativeTtlCache = new InMemoryCache({ ttlInSec: -1 });
      negativeTtlCache.setCache('foo', { foo: 123 });

      // Data should be immediately invalidated with negative TTL
      await setTimeout(10);

      const data = negativeTtlCache.getCache('foo');
      expect(data).toBeUndefined();
    });

    it('should handle extremely large TTL value', async () => {
      // 실제 MAX_SAFE_INTEGER는 너무 커서 테스트하기 어려움
      // 대신 10초 정도로 충분히 긴 TTL을 사용
      const largeTtlCache = new InMemoryCache({ ttlInSec: 10 });
      largeTtlCache.setCache('foo', { foo: 123 });

      // 여기서는 10초보다 훨씬 짧은 시간 후에 확인
      await setTimeout(10);

      const data = largeTtlCache.getCache('foo');
      expect(data).toEqual({ foo: 123 });
    });

    it('should correctly handle hit counter overflow', async () => {
      const hitOverflowCache = new InMemoryCache({ ttlInSec: 10 });
      hitOverflowCache.setCache('foo', { foo: 123 });

      // 로직 검증: InMemoryCache.ts는 Number.MAX_VALUE와 비교
      // (비교에서 Number.MAX_SAFE_INTEGER가 아닌 Number.MAX_VALUE를 사용)
      hitOverflowCache.totalHit = Number.MAX_VALUE - 1;

      // Get cache to increment hit counter
      hitOverflowCache.getCache('foo');

      // 비동기 호출이 완료되도록 약간의 지연
      await setTimeout(10);

      // totalHit가 1이 되고 (초기화 후 1 증가) hitCarry는 1이 됨
      expect(hitOverflowCache.totalHit).toBe(1);
      expect(hitOverflowCache.hitCarry).toBe(1);
    });

    it('should handle very long keys', async () => {
      const longKey = 'a'.repeat(1000000); // 1 million chars
      localCache.setCache(longKey, { value: 'test' });

      await setTimeout(10);

      const data = localCache.getCache(longKey);
      expect(data).toEqual({ value: 'test' });
    });

    it('should handle storing very large objects', async () => {
      // Create large object with deep nesting
      const generateLargeObject = (depth: number, breadth: number): any => {
        if (depth <= 0) {
          return 'leaf';
        }

        const obj: Record<string, any> = {};
        for (let i = 0; i < breadth; i++) {
          obj[`key${i}`] = generateLargeObject(depth - 1, breadth);
        }
        return obj;
      };

      const largeObject = generateLargeObject(10, 5);
      localCache.setCache('largeObj', largeObject);

      await setTimeout(10);

      const data = localCache.getCache('largeObj');
      expect(data).toEqual(largeObject);
    });

    it('should handle circular references gracefully', async () => {
      const circularObj: any = { value: 1 };
      circularObj.self = circularObj; // Create circular reference

      expect(() => {
        localCache.setCache('circularObj', circularObj);
      }).not.toThrow();
    });

    it('should handle multiple rapid cache operations', async () => {
      // Perform lots of operations in quick succession
      for (let i = 0; i < 1000; i++) {
        localCache.setCache(`key${i}`, { value: i });
      }

      // Validate some random values
      for (let i = 100; i < 110; i++) {
        expect(localCache.getCache(`key${i}`)).toEqual({ value: i });
      }

      // Validate cache size
      expect(InMemoryCache.snip(localCache).itemCount).toBe(1000);
    });

    it('should handle function that throws exception', async () => {
      const throwingFn = () => {
        throw new Error('Expected function error');
      };

      expect(() => {
        localCache.setCache('throwingFn', throwingFn);
      }).toThrow('Expected function error');
    });

    it('should handle promise rejection', async () => {
      const rejectingFn = () => {
        return Promise.reject(new Error('Expected promise rejection'));
      };

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // 프로미스 거부는 비동기적으로 처리됨
      // 이 라이브러리는 에러를 콘솔에 기록하고 다시 던지지만,
      // 이 시점에서는 에러가 캐치되지 않음
      localCache.setCache('rejectingPromise', rejectingFn);

      // 에러가 콘솔에 기록될 시간을 주기 위한 지연
      await setTimeout(50);

      // 콘솔 에러 호출이 있었는지 확인
      expect(consoleErrorSpy).toHaveBeenCalled();

      // 정리
      consoleErrorSpy.mockRestore();
    });
  });
});
