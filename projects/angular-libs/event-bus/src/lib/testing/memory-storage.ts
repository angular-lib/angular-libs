import { StorageLike } from '../storage';

/** @internal Test-only in-memory Storage. */
export class MemoryStorage implements StorageLike {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
  removeItem(key: string): void {
    this.items.delete(key);
  }
  json(key: string): any {
    const text = this.items.get(key);
    return text === undefined ? undefined : JSON.parse(text);
  }
}
