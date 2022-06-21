export interface Serializer {
  serialize<T = unknown>(o: T): string;
  deserialize<T = unknown>(s: string): T | null;
}
