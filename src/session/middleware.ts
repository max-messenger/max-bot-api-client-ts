import { KeyedExecutor } from '../core/keyed-executor';
import type { Context } from '../core/context';
import type { MiddlewareFn } from '../core/middleware';
import { MemorySessionStore } from './memory-store';
import type { SessionOptions, SessionProperty } from './types';

/** Добавляет в Context состояние пользователя и чата между update. */
export function session<
  S extends object & NonNullable<C[P]>,
  C extends Context & { [key in P]?: C[P] },
  P extends SessionProperty<C> = 'session',
>(options: SessionOptions<S, C, P> = {}): MiddlewareFn<C> {
  const property = options.property ?? ('session' as P);
  // Пользовательское имя записывается через Reflect.set, поэтому опасные ключи запрещены.
  if (['__proto__', 'constructor', 'prototype'].includes(property)) {
    throw new TypeError(`Unsafe session property "${property}"`);
  }
  const getSessionKey = options.getSessionKey ?? defaultGetSessionKey;
  const store = options.store ?? new MemorySessionStore<S>();
  const createSession = options.defaultSession ?? (() => ({} as S));
  const executor = new KeyedExecutor();

  return async (ctx, next) => {
    const key = await getSessionKey(ctx);
    if (key == null) {
      // Update без пользователя или чата проходит дальше без общего фиктивного ключа.
      Reflect.set(ctx, property, undefined);
      return next();
    }

    // Внутри процесса update одного ключа выполняются по очереди и не затирают изменения.
    return executor.run(key, async () => {
      const value = await store.get(key) ?? createSession(ctx);
      Reflect.set(ctx, property, value);

      try {
        return await next();
      } finally {
        // Изменения session сохраняются и при ошибке следующего обработчика.
        // Scenario применяет собственный transition только после успешного шага.
        const current = Reflect.get(ctx, property) as S | null | undefined;
        if (current == null) {
          await store.delete(key);
        } else {
          await store.set(key, current);
        }
      }
    });
  };
}

const defaultGetSessionKey = (ctx: Context): string | undefined => {
  const { chatId, user } = ctx;
  const userId = user?.user_id;
  if (userId == null || chatId == null) return undefined;
  return `${userId}:${chatId}`;
};
