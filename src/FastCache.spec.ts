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

  describe('sortedSet', () => {
    describe('add', () => {
      test('값을 추가하면 정상적으로 저장된다', async () => {
        const sortedSet = cache.sortedSet('hello');
        sortedSet.add(100, 'foo');
        sortedSet.add(200, 'bar');
        sortedSet.add(300, 'baz');

        const result = await sortedSet.range({ start: 0, stop: 2, withScores: true });
        expect(result).toEqual([
          { value: 'foo', score: 100 },
          { value: 'bar', score: 200 },
          { value: 'baz', score: 300 },
        ]);
      });
    });

    describe('addAll', () => {
      test('여러 값을 순서와 상관없이 넣어도 정렬된 값으로 저장된다', async () => {
        const sortedSet = cache.sortedSet('hello');
        await sortedSet.addAll([
          { score: 300, value: 'baz' },
          { score: 200, value: 'bar' },
          { score: 100, value: 'foo' },
          { score: 400, value: 'qux' },
          { score: 500, value: 'quux' },
        ]);

        const result1 = await sortedSet.range({ start: 0, stop: 2, withScores: true });
        const result2 = await sortedSet.range({ start: 3, stop: 4, withScores: true });

        expect(result1).toEqual([
          { value: 'foo', score: 100 },
          { value: 'bar', score: 200 },
          { value: 'baz', score: 300 },
        ]);
        expect(result2).toEqual([
          { value: 'qux', score: 400 },
          { value: 'quux', score: 500 },
        ]);
      });
    });

    describe('remove', () => {
      test('값을 삭제하면 해당 값이 사라진다', async () => {
        const sortedSet = cache.sortedSet('hello');

        await sortedSet.addAll([
          { score: 100, value: 'foo' },
          { score: 200, value: 'bar' },
          { score: 300, value: 'baz' },
        ]);
        await sortedSet.remove('foo');

        const result = await sortedSet.range({ start: 0, stop: 2, withScores: true });

        expect(result).toEqual([
          { value: 'bar', score: 200 },
          { value: 'baz', score: 300 },
        ]);
      });
    });

    describe('range', () => {
      test('score 없이 조회하면 값만 반환된다', async () => {
        const sortedSet = cache.sortedSet('hello');

        await sortedSet.addAll([
          { score: 100, value: 'foo' },
          { score: 200, value: 'bar' },
          { score: 300, value: 'baz' },
        ]);

        const result = await sortedSet.range({ start: 0, stop: 2, withScores: false });

        expect(result).toEqual(['foo', 'bar', 'baz']);
      });

      test('score와 함께 조회하면 값과 score가 반환된다', async () => {
        const sortedSet = cache.sortedSet('hello');
        await sortedSet.addAll([
          { score: 100, value: 'foo' },
          { score: 200, value: 'bar' },
          { score: 300, value: 'baz' },
        ]);

        const result = await sortedSet.range({ start: 0, stop: 2, withScores: true });

        expect(result).toEqual([
          { value: 'foo', score: 100 },
          { value: 'bar', score: 200 },
          { value: 'baz', score: 300 },
        ]);
      });

      test('reverse 옵션을 주면 역순으로 조회된다', async () => {
        const sortedSet = cache.sortedSet('hello');
        await sortedSet.addAll([
          { score: 100, value: 'foo' },
          { score: 200, value: 'bar' },
          { score: 300, value: 'baz' },
        ]);

        const result = await sortedSet.range({ start: 0, stop: 2, withScores: true, reverse: true });

        expect(result).toEqual([
          { value: 'baz', score: 300 },
          { value: 'bar', score: 200 },
          { value: 'foo', score: 100 },
        ]);
      });
    });

    describe('rangeByScore', () => {
      test('score 없이 score 범위로 조회하면 값만 반환된다', async () => {
        const sortedSet = cache.sortedSet('hello');
        await sortedSet.addAll([
          { score: 100, value: 'foo' },
          { score: 200, value: 'bar' },
          { score: 300, value: 'baz' },
        ]);
        const result = await sortedSet.rangeByScore({ min: 150, max: 250 });
        expect(result).toEqual(['bar']);
      });

      test('score와 함께 score 범위로 조회하면 값과 score가 반환된다', async () => {
        const sortedSet = cache.sortedSet('hello');
        await sortedSet.addAll([
          { score: 100, value: 'foo' },
          { score: 200, value: 'bar' },
          { score: 300, value: 'baz' },
        ]);
        const result = await sortedSet.rangeByScore({ min: 150, max: 250, withScores: true });
        expect(result).toEqual([{ value: 'bar', score: 200 }]);
      });
    });

    describe('score', () => {
      test('특정 값의 score를 조회할 수 있다', async () => {
        const sortedSet = cache.sortedSet('hello');
        await sortedSet.addAll([
          { score: 100, value: 'foo' },
          { score: 200, value: 'bar' },
        ]);

        const result1 = await sortedSet.score('foo');
        const result2 = await sortedSet.score('bar');
        const result3 = await sortedSet.score('__not_found__');

        expect(result1).toBe(100);
        expect(result2).toBe(200);
        expect(result3).toBeNull();
      });
    });

    describe('length', () => {
      test('전체 값의 개수를 조회할 수 있다', async () => {
        const sortedSet = cache.sortedSet('hello');
        await sortedSet.addAll([
          { score: 100, value: 'foo' },
          { score: 200, value: 'bar' },
          { score: 300, value: 'baz' },
        ]);

        const result = await sortedSet.length();

        expect(result).toBe(3);
      });
    });

    describe('clear', () => {
      test('전체 값을 삭제하면 길이가 0이 된다', async () => {
        const sortedSet = cache.sortedSet('hello');
        await sortedSet.addAll([
          { score: 100, value: 'foo' },
          { score: 200, value: 'bar' },
          { score: 300, value: 'baz' },
        ]);
        await sortedSet.clear();

        const result = await sortedSet.length();
        expect(result).toBe(0);
      });
    });

    describe('replaceAll', () => {
      test('전체 값을 새로운 값으로 교체할 수 있다', async () => {
        const sortedSet = cache.sortedSet('hello');
        await sortedSet.addAll([
          { score: 100, value: 'foo' },
          { score: 200, value: 'bar' },
          { score: 300, value: 'baz' },
        ]);
        const newEntries = [
          { score: 400, value: 'qux' },
          { score: 500, value: 'quux' },
        ];

        await sortedSet.replaceAll(newEntries);

        const [values, tempKeys] = await Promise.all([
          sortedSet.range({ start: 0, stop: -1, withScores: true }),
          client.keys('hello:temp:*'),
        ]);

        expect(values).toEqual([
          { value: 'qux', score: 400 },
          { value: 'quux', score: 500 },
        ]);
        // tempKeys는 존재하지 않아야 한다.
        expect(tempKeys).toHaveLength(0);
      });

      test('score가 number가 아니면 예외가 발생하고 임시키가 정리된다', async () => {
        const sortedSet = cache.sortedSet('hello');
        const invalidEntries = [{ score: 'invalid' as any, value: 'qux' }];

        await expect(sortedSet.replaceAll(invalidEntries)).rejects.toThrow('score is not a number');

        const [tempKeys, values] = await Promise.all([
          client.keys('hello:temp:*'),
          sortedSet.range({ start: 0, stop: -1 }),
        ]);

        // tempKeys는 존재하지 않아야 한다.
        expect(tempKeys).toHaveLength(0);
        expect(values).toHaveLength(0);
      });
    });

    describe('zincrBy', () => {
      test('값의 score를 증가시키면 증가된 score가 반환된다', async () => {
        const sortedSet = cache.sortedSet('hello');

        await sortedSet.add(100, 'foo');
        const newScore1 = await sortedSet.zincrBy('foo', 50);
        expect(newScore1).toBe(150);
        const newScore2 = await sortedSet.zincrBy('foo', 25);
        expect(newScore2).toBe(175);
      });

      test('새로운 값을 추가할 때도 정상 동작하는지 확인', async () => {
        const sortedSet = cache.sortedSet('hello');
        await sortedSet.zincrBy('foo', 10);

        const score = await sortedSet.score('foo');

        expect(score).toBe(10);
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
});
