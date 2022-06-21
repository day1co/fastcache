import { JsonSerializer } from './json-serializer';

describe('JsonSerializer', () => {
  describe('serialize', () => {
    test('should work', async () => {
      const testee = new JsonSerializer();
      expect(testee.serialize<number>(100)).toBe('100');
      expect(testee.serialize<string>('hello')).toBe('"hello"');
      expect(testee.serialize<boolean>(true)).toBe('true');
      expect(testee.serialize<Date>(new Date(0))).toBe('"1970-01-01T00:00:00.000Z"');
    });
  });
  describe('deserialize', () => {
    test('should work', async () => {
      const testee = new JsonSerializer();
      expect(testee.deserialize<number>('100')).toBe(100);
      expect(testee.deserialize<string>('"hello"')).toBe('hello');
      expect(testee.deserialize<boolean>('true')).toBe(true);
      // NOTE!
      expect(testee.serialize<string>('"1970-01-01T00:00:00.000Z"')).toBe('1970-01-01T00:00:00.000Z');
    });
  });
});
