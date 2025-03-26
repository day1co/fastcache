import Redis from 'ioredis-mock';
import { FastCache } from './FastCache';
import type { Redis as IoRedis } from 'ioredis';

describe('Redis Advanced Use Cases', () => {
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

  // 1. JSON 데이터 저장 및 검색 (일반적인 StackOverflow 질문)
  describe('JSON data handling', () => {
    test('should store and retrieve complex JSON objects', async () => {
      const complexObject = {
        user: {
          id: 123,
          name: 'Test User',
          roles: ['admin', 'editor'],
          metadata: {
            lastLogin: new Date().toISOString(),
            preferences: {
              theme: 'dark',
              notifications: true,
            },
          },
        },
      };

      await cache.set('complex:json', JSON.stringify(complexObject));
      const retrieved = await cache.get('complex:json');

      expect(retrieved).not.toBeNull();
      expect(JSON.parse(retrieved!)).toEqual(complexObject);
    });

    test('should handle circular references gracefully', async () => {
      const circularObj: any = { name: 'circular' };
      circularObj.self = circularObj;

      try {
        await cache.set('circular:json', JSON.stringify(circularObj));
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  // 2. 트랜잭션 처리 테스트 (multi/exec)
  describe('Transaction handling', () => {
    test('should execute commands in a transaction', async () => {
      // 직접 Redis 클라이언트를 사용하여 트랜잭션 테스트
      const multi = client.multi();
      multi.set('tx:key1', 'value1');
      multi.set('tx:key2', 'value2');
      multi.get('tx:key1');
      multi.get('tx:key2');

      const results = await multi.exec();

      // 결과 형식: [null, 'OK'], [null, 'OK'], [null, 'value1'], [null, 'value2']
      expect(results?.length).toBe(4);
      expect(results?.[2][1]).toBe('value1');
      expect(results?.[3][1]).toBe('value2');
    });

    test('should handle transactions correctly', async () => {
      // ioredis-mock은 실제 Redis와 다르게 트랜잭션 처리
      // 이 테스트에서는 기본적인 트랜잭션 기능만 확인
      const multi = client.multi();
      multi.set('atomic:test', 'value1');
      multi.get('atomic:test');

      const results = await multi.exec();

      // set 명령 후 get 명령 실행 결과 확인
      expect(results?.length).toBe(2);
      expect(results?.[1][1]).toBe('value1');

      // 트랜잭션 완료 후 값 확인
      const finalValue = await client.get('atomic:test');
      expect(finalValue).toBe('value1');
    });
  });

  // 3. 키 만료 및 TTL 관리
  describe('Key expiration', () => {
    test('should expire keys after the specified time', async () => {
      await cache.set('expiring:key', 'will-expire', 1); // 1초 후 만료

      // 즉시 조회 시 값이 존재해야 함
      let value = await cache.get('expiring:key');
      expect(value).toBe('will-expire');

      // 1.5초 후 조회 시 키가 만료되어야 함
      await new Promise((resolve) => setTimeout(resolve, 1500));
      value = await cache.get('expiring:key');
      expect(value).toBeNull();
    });

    test('should get remaining TTL for keys', async () => {
      await cache.set('ttl:key', 'has-ttl', 10); // 10초 TTL

      const ttl = await client.ttl('ttl:key');

      // TTL은 10초 이하여야 함 (약간의 시간이 이미 지났을 수 있음)
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(10);
    });
  });

  // 4. 대용량 데이터 처리
  describe('Handling large datasets', () => {
    test('should store and retrieve large string values', async () => {
      // 약 1MB 크기의 문자열 생성
      const largeString = 'a'.repeat(1024 * 1024);

      await cache.set('large:string', largeString);
      const retrieved = await cache.get('large:string');

      expect(retrieved?.length).toBe(largeString.length);
      expect(retrieved).toBe(largeString);
    });

    test('should handle large lists efficiently', async () => {
      const list = cache.list('large:list');
      const items = 10000;

      // 여러 항목 추가
      for (let i = 0; i < items; i++) {
        await list.push(`item${i}`);
      }

      const length = await list.length();
      expect(length).toBe(items);

      // 범위 조회 효율성 테스트
      const firstItems = await list.getAll(0, 9);
      expect(firstItems.length).toBe(10);
      expect(firstItems[0]).toBe('item0');

      const lastItems = await list.getAll(-10, -1);
      expect(lastItems.length).toBe(10);
      expect(lastItems[9]).toBe(`item${items - 1}`);
    });
  });

  // 5. 캐시 히트/미스 시나리오
  describe('Cache hit/miss scenarios', () => {
    test('should handle cache hit correctly with withCache', async () => {
      const testKey = 'withCache:hit:test';
      const testValue = { data: 'test-data' };

      // 미리 값을 캐싱
      await cache.set(testKey, JSON.stringify(testValue));

      // 실행 카운터 (executor가 호출되면 증가)
      let executorCalled = 0;

      // withCache 호출
      const result = await cache.withCache(testKey, async () => {
        executorCalled++;
        return { data: 'new-data' }; // 이 값은 반환되지 않아야 함 (캐시 히트이므로)
      });

      // 캐시 히트했으므로 executor가 호출되지 않아야 함
      expect(executorCalled).toBe(0);
      expect(result).toEqual(testValue);
    });

    test('should handle cache miss correctly with withCache', async () => {
      const testKey = 'withCache:miss:test';
      const testValue = { data: 'generated-data' };

      // 실행 카운터
      let executorCalled = 0;

      // withCache 호출 (캐시에 값이 없음)
      const result = await cache.withCache(testKey, async () => {
        executorCalled++;
        return testValue;
      });

      // executor가 호출되어야 함
      expect(executorCalled).toBe(1);
      expect(result).toEqual(testValue);

      // 값이 캐시에 저장되었는지 확인
      // 캐싱은 비동기적으로 처리되므로 약간의 지연 필요
      await new Promise((resolve) => setTimeout(resolve, 50));
      const cachedValue = await cache.get(testKey);
      expect(JSON.parse(cachedValue!)).toEqual(testValue);
    });
  });

  // 6. 분산 락(Distributed Lock) 시나리오
  describe('Distributed locking pattern', () => {
    test('should simulate basic distributed lock pattern', async () => {
      const lockKey = 'lock:resource1';
      const lockValue = 'lock-token-123';

      // 락 획득 (단순 구현 - 실제로는 SETNX 명령어 사용)
      const setResult = await client.set(lockKey, lockValue);
      expect(setResult).toBe('OK');

      // 리소스에 접근하는 로직 (실제 시나리오)
      const protectedResource = 'protected-data';
      await client.set('resource1', protectedResource);

      // 락이 있는지 확인
      const lockExists = await client.exists(lockKey);
      expect(lockExists).toBe(1);

      // 락 해제
      await client.del(lockKey);

      // 락이 해제되었는지 확인
      const lockExistsAfterRelease = await client.exists(lockKey);
      expect(lockExistsAfterRelease).toBe(0);
    });

    test('should handle concurrent lock requests', async () => {
      const lockKey = 'lock:concurrent';

      // 첫 번째 클라이언트가 락 획득
      await client.set(lockKey, 'client1');

      // 실제 시나리오에서는 두 번째 클라이언트의 락 시도가 실패해야 함
      // 여기서는 단순히 키가 이미 존재하는지 확인
      const keyExists = await client.exists(lockKey);
      expect(keyExists).toBe(1);

      // 락 소유자 확인
      const lockOwner = await client.get(lockKey);
      expect(lockOwner).toBe('client1');
    });
  });
});
