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
      const _firstCall_ = localCache.withCache('foo', fetchSomething);

      await setTimeout(10);

      const _secondCall_ = localCache.withCache('foo', fetchSomething);
      const _thirdCall_ = localCache.withCache('foo', fetchSomething);

      await setTimeout(10);

      const _anotherCall_ = localCache.withCache('bar', fetchSomething);

      await setTimeout(10);

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
  });
});
