import type { SyncSessionStore } from './types';

const clone = <T>(value: T): T => structuredClone(value);

/** Process-local store for development, tests, and single-instance bots. */
export class MemorySessionStore<T> implements SyncSessionStore<T> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();

  constructor(private readonly ttl = Infinity) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (entry === undefined) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return clone(entry.value);
  }

  set(key: string, value: T): void {
    this.entries.set(key, {
      value: clone(value),
      expiresAt: Date.now() + this.ttl,
    });
  }

  delete(key: string): void {
    this.entries.delete(key);
  }
}
