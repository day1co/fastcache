import { Serializer } from './serializer';

export class JsonSerializer implements Serializer {
  serialize<T = unknown>(o: T): string {
    try {
      return JSON.stringify(o);
    } catch (e) {
      // TODO: better error handling
      return '';
    }
  }

  deserialize<T = unknown>(s: string): T | null {
    try {
      return JSON.parse(s);
    } catch (e) {
      // TODO: better error handling
      return null;
    }
  }
}
