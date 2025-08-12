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

  describe('multi', () => {
    describe('기본 키-값 조작', () => {
      test('set과 get을 함께 실행할 수 있다', async () => {
        const results = await cache.multi().set('test:key', 'test:value', 3600).get('test:key').exec();

        expect(results).toHaveLength(2);
        expect(results[0]).toEqual('OK'); // set 결과
        expect(results[1]).toEqual('test:value'); // get 결과

        // 실제로 저장되었는지 확인
        const value = await cache.get('test:key');
        expect(value).toBe('test:value');
      });

      test('remove를 포함한 명령을 실행할 수 있다', async () => {
        // 먼저 키를 설정
        await cache.set('test:remove', 'value');

        const results = await cache.multi().get('test:remove').remove('test:remove').get('test:remove').exec();

        expect(results).toHaveLength(3);
        expect(results[0]).toEqual('value'); // 첫 번째 get
        expect(results[1]).toEqual(1); // remove (삭제된 키 개수)
        expect(results[2]).toEqual(null); // 두 번째 get (삭제 후)
      });
    });

    describe('list 조작', () => {
      test('list 관련 명령을 실행할 수 있다', async () => {
        const results = await cache
          .multi()
          .listPush('test:list', 'item1')
          .listPush('test:list', 'item2')
          .listUnshift('test:list', 'item0')
          .listPop('test:list')
          .listShift('test:list')
          .listSetAll('test:list', ['item3', 'item4'])
          .listGetAll('test:list', 0, -1)
          .listRemoveAll('test:list', 2, 3)
          .listLength('test:list')
          .exec();

        expect(results).toHaveLength(9);
        expect(results[0]).toEqual(1); // rpush item1
        expect(results[1]).toEqual(2); // rpush item2
        expect(results[2]).toEqual(3); // lpush item0
        expect(results[3]).toEqual('item2'); // rpop
        expect(results[4]).toEqual('item0'); // lpop
        expect(results[5]).toEqual(3); // lset
        expect(results[6]).toEqual(['item4', 'item3', 'item1']); // lrange
        expect(results[7]).toEqual('OK'); // ltrim
        expect(results[8]).toEqual(1); // llen

        // 최종 상태 확인
        const finalList = await cache.list('test:list').getAll(0, -1);
        expect(finalList).toEqual(['item1']);
      });
    });

    describe('map 조작', () => {
      test('map 관련 명령을 실행할 수 있다', async () => {
        const results = await cache
          .multi()
          .mapSet('test:hash', 'field1', 'value1')
          .mapSet('test:hash', 'field2', 'value2')
          .mapGet('test:hash', 'field1')
          .mapGet('test:hash', 'field2')
          .mapGet('test:hash', 'nonexistent')
          .mapRemove('test:hash', 'field1')
          .exec();

        expect(results).toHaveLength(6);
        expect(results[0]).toEqual(1); // hset field1
        expect(results[1]).toEqual(1); // hset field2
        expect(results[2]).toEqual('value1'); // hget field1
        expect(results[3]).toEqual('value2'); // hget field2
        expect(results[4]).toEqual(null); // hget nonexistent
        expect(results[5]).toEqual(1); // hdel field1

        // 최종 상태 확인
        const remainingValue = await cache.map('test:hash').get('field2');
        expect(remainingValue).toBe('value2');
      });

      test('map 일괄 조작 명령을 실행할 수 있다', async () => {
        const results = await cache
          .multi()
          .mapSetAll('test:hash2', {
            name: 'John',
            email: 'john@example.com',
            age: '30',
          })
          .mapGetAll('test:hash2', ['name', 'email', 'age'])
          .mapRemoveAll('test:hash2', ['email', 'age'])
          .exec();

        expect(results).toHaveLength(3);
        expect(results[0]).toEqual('OK'); // hmset
        expect(results[1]).toEqual(['John', 'john@example.com', '30']); // hmget
        expect(results[2]).toEqual(2); // hdel (삭제된 필드 개수)

        // 최종 상태 확인
        const remainingValue = await cache.map('test:hash2').get('name');
        expect(remainingValue).toBe('John');
      });
    });

    describe('set 조작', () => {
      test('set 관련 명령을 실행할 수 있다', async () => {
        const results = await cache
          .multi()
          .setAdd('test:set', 'member1', 'member2', 'member3')
          .setAdd('test:set', 'member2', 'member4') // 중복 제거됨
          .setContains('test:set', 'member1')
          .setContains('test:set', 'nonexistent')
          .setLength('test:set')
          .setRemove('test:set', 'member1', 'member2')
          .exec();

        expect(results).toHaveLength(6);
        expect(results[0]).toEqual(3); // sadd (3개 추가)
        expect(results[1]).toEqual(1); // sadd (1개 추가, 1개 중복)
        expect(results[2]).toEqual(1); // sismember (존재)
        expect(results[3]).toEqual(0); // sismember (존재하지 않음)
        expect(results[4]).toEqual(4); // scard (총 4개)
        expect(results[5]).toEqual(2); // srem (2개 제거)

        // 최종 상태 확인
        const finalLength = await cache.setOf('test:set').length();
        expect(finalLength).toBe(2);
      });
    });

    describe('만료 시간 설정', () => {
      test('expire 명령을 실행할 수 있다', async () => {
        await cache.set('test:expire', 'value');

        const results = await cache.multi().expire('test:expire', 3600).get('test:expire').exec();

        expect(results).toHaveLength(2);
        expect(results[0]).toEqual(1); // expire (설정 성공)
        expect(results[1]).toEqual('value'); // get

        // TTL 확인 (대략적인 값)
        const ttl = await client.ttl('test:expire');
        expect(ttl).toBeGreaterThan(3500); // 3600에 가까운 값
      });
    });

    describe('복합 명령', () => {
      test('여러 타입의 명령을 함께 실행할 수 있다', async () => {
        const results = await cache
          .multi()
          .set('user:123', 'John Doe', 3600)
          .mapSet('user:123:profile', 'name', 'John Doe')
          .mapSet('user:123:profile', 'email', 'john@example.com')
          .setAdd('user:123:tags', 'premium', 'verified')
          .listPush('user:123:activities', 'login:2024-01-01')
          .expire('user:123:profile', 7200)
          .exec();

        expect(results).toHaveLength(6);
        expect(results[0]).toEqual('OK'); // set
        expect(results[1]).toEqual(1); // hset name
        expect(results[2]).toEqual(1); // hset email
        expect(results[3]).toEqual(2); // sadd
        expect(results[4]).toEqual(1); // rpush
        expect(results[5]).toEqual(1); // expire

        // 모든 데이터가 올바르게 저장되었는지 확인
        const [userValue, profile, tags, activities] = await Promise.all([
          cache.get('user:123'),
          cache.map('user:123:profile').getAll(['name', 'email']),
          cache.setOf('user:123:tags').length(),
          cache.list('user:123:activities').getAll(0, -1),
        ]);

        expect(userValue).toBe('John Doe');
        expect(profile).toEqual(['John Doe', 'john@example.com']);
        expect(tags).toBe(2); // premium, verified
        expect(activities).toEqual(['login:2024-01-01']);
      });
    });

    describe('에러 처리', () => {
      test('명령이 없을 때 exec()를 호출하면 빈 배열을 반환한다', async () => {
        const results = await cache.multi().exec();
        expect(results).toEqual([]);
      });

      test('잘못된 명령이 있어도 다른 명령은 실행된다', async () => {
        // 존재하지 않는 키에 대해 get 실행
        const results = await cache.multi().set('test:valid', 'value').get('test:nonexistent').get('test:valid').exec();

        expect(results).toHaveLength(3);
        expect(results[0]).toEqual('OK'); // set 성공
        expect(results[1]).toEqual(null); // get 실패 (null 반환)
        expect(results[2]).toEqual('value'); // get 성공
      });
    });
  });
});
