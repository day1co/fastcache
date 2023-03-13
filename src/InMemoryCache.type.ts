export interface InMemoryCacheConstructor {
  ttlInSec: number;
}

export function isFunction(data: unknown): data is () => unknown {
  return data instanceof Function;
}

export function isPromised(data: unknown): data is Promise<unknown> {
  return data instanceof Promise;
}
