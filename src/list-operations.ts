export interface ListOperations {
  key: string;
  push(value: string): Promise<void>;
  pop(): Promise<string | null>;
  unshift(value: string): Promise<void>;
  shift(): Promise<string | null>;
  setAll(values: Array<string>): Promise<void>;
  getAll(start: number, stop: number): Promise<Array<string | null>>;
  removeAll(start: number, stop: number): Promise<void>;
  length(): Promise<number>;
}
