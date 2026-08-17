import type { SyncSessionStore } from './types';

// Callers never receive the object held by the store itself. This prevents a
// session from changing outside session middleware without an explicit set().
const clone = <T>(value: T): T => structuredClone(value);

/**
 * Process-local store for development and tests.
 * All sessions are lost when the process stops, crashes, or restarts.
 */
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
      // Every successful write refreshes the TTL, making it an inactivity TTL.
      expiresAt: Date.now() + this.ttl,
    });
  }

  delete(key: string): void {
    this.entries.delete(key);
  }
}
