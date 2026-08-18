/**
 * Serializes asynchronous work for the same key while allowing different keys
 * to progress independently. The queue is process-local; distributed workers
 * still need optimistic locking or an external lock in their storage backend.
 */
export class KeyedExecutor {
  private readonly tails = new Map<string, Promise<void>>();

  async run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    let release: () => void = () => undefined;
    // The gate becomes this task's tail and releases the next queued task.
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => gate);
    this.tails.set(key, tail);

    // Only a predecessor with the same key delays this task.
    await previous;
    try {
      return await task();
    } finally {
      release();
      // A later task may already have replaced this tail. Only the newest task
      // is allowed to remove the queue entry.
      if (this.tails.get(key) === tail) this.tails.delete(key);
    }
  }
}
