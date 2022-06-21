export interface SetOperations {
  key: string;
  add(...values: Array<string>): Promise<void>;
  remove(...values: Array<string>): Promise<void>;
  contains(value: string): Promise<boolean>;
  length(): Promise<number>;
}
