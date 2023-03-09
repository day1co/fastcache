import { setTimeout } from 'node:timers/promises';

import { FastCache } from '../src';

const getData = async (id: number) => {
  await setTimeout(10);
  console.log('should called once');
  return `${id}:with data`;
};

const main = async () => {
  const cache = FastCache.create({ redis: { host: '127.0.0.1', port: 6379, db: 0 } });

  console.log('== start of main ==');

  await cache.set('foo', 'hello');
  console.log(await cache.get('foo'));
  // hello

  const list = cache.list('bar');
  await list.unshift('one');
  await list.push('two');
  console.log(await list.getAll(0, -1));
  // [ one, two ]
  console.log(await list.shift());
  // one
  console.log(await list.pop());
  // two

  const map = cache.map('baz');
  await map.set('one', 'first');
  await map.set('two', 'second');
  console.log(await map.get('one'));
  // first
  console.log(await map.getAll(['one', 'two']));
  // [ first, second ]

  await cache.withCache('page@10', async () => {
    const result = await getData(10);
    console.log('retrieved:', result);

    return result;
  });

  await setTimeout(1000);

  const result = await cache.withCache('page@10', () => {
    return getData(10);
  });

  console.log('cached:', result);
  // clear cache for test
  // await cache.remove('page@10');

  cache.destroy();

  console.log('== end of main ==');
};

main().then(console.info).catch(console.error);
