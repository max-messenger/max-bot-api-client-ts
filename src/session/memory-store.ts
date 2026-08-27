import type { SyncSessionStore } from './types';

// Возвращаем копии, чтобы состояние менялось только через `set()`.
const clone = <T>(value: T): T => structuredClone(value);

/**
 * Локальное хранилище для разработки и тестов.
 * При остановке или перезапуске процесса все данные теряются.
 */
export class MemorySessionStore<T> implements SyncSessionStore<T> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();

  constructor(private readonly timeToLive = Infinity) {}

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
      // При каждом сохранении заново отсчитываем срок хранения сессии.
      expiresAt: Date.now() + this.timeToLive,
    });
  }

  delete(key: string): void {
    this.entries.delete(key);
  }
}
