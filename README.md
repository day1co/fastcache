# fastcache

fast and simple cache using redis

![version](https://img.shields.io/github/package-json/v/day1co/fastcache)

## Getting Started

```js
const { FastCache } = require('@fastcampus/fastcache');

const cache = FastCache.create({ redis: { host: '127.0.0.1', port: 6379, db: 0 } });

await cache.set('foo', 'hello');
await cache.get('foo');
// hello

const list = cache.list('bar');
await list.unshift('one');
await list.push('two');
await list.getAll();
// [ one, two ]
await list.shift();
// one
await list.pop();
// two

const map = cache.map('baz');
await map.set('one', 'first');
await map.set('two', 'second');
await map.get('one');
// first
await map.getAll(['one', 'two']);
// [ first, second ]
```
## withCache in real world

checkout example.ts

```js
function getDataByIdWithCache(id) {
  return this.cacheService.withCache(`course@${id}`, () => {
    return this.getDataById(id);
  });
}

async function getDataById(id) {
  const course = await this.redstoneDataService.getDataById(id);
  if (!course || !course.id) {
    logger.warn('unavailable course requested %s', id);
    return {};
  }
  return course;
}
```

## Contributing

### test

```console
$ npm run test
```

### build

```console
$ npm run build
```

### watch(continuous build)

```console
$ npm start
```

---
may the **SOURCE** be with you...
