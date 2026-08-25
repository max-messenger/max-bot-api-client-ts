/** Последовательно выполняет задачи одного ключа, не блокируя остальные ключи. */
export class KeyedExecutor {
  private readonly tails = new Map<string, Promise<void>>();

  async run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    let release: () => void = () => undefined;
    // Этот Promise становится концом очереди и после выполнения отпускает следующую задачу.
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => gate);
    this.tails.set(key, tail);

    // Ожидается только предыдущая задача с тем же ключом.
    await previous;
    try {
      return await task();
    } finally {
      release();
      // Новая задача могла заменить конец очереди, поэтому удаляем только актуальную запись.
      if (this.tails.get(key) === tail) this.tails.delete(key);
    }
  }
}
