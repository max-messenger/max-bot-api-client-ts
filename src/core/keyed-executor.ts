/** Выполняет задачи с одинаковым ключом по очереди, не блокируя остальные ключи. */
export class KeyedExecutor {
  private readonly tails = new Map<string, Promise<void>>();

  async run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    let release: () => void = () => undefined;
    // Добавляем текущую задачу в конец очереди для этого ключа.
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => gate);
    this.tails.set(key, tail);

    // Перед запуском ждём только предыдущую задачу с тем же ключом.
    await previous;
    try {
      return await task();
    } finally {
      release();
      // Не удаляем очередь, если после нас в неё уже добавили новую задачу.
      if (this.tails.get(key) === tail) this.tails.delete(key);
    }
  }
}
