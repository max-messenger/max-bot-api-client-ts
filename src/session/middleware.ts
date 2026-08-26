import type { Context } from '../core/context';
import { KeyedExecutor } from '../core/keyed-executor';
import type { MiddlewareFn } from '../core/middleware';
import { MemorySessionStore } from './memory-store';
import type { SessionOptions, SessionProperty } from './types';

/** Добавляет в Context состояние пользователя и чата между событиями. */
export function session<
  S extends object & NonNullable<C[P]>,
  C extends Context & { [key in P]?: C[P] },
  P extends SessionProperty<C> = 'session',
>(options: SessionOptions<S, C, P> = {}): MiddlewareFn<C> {
  const property = options.property ?? ('session' as P);
  // Поле задаётся динамически, поэтому запрещаем имена, способные изменить прототип Context.
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
      // Без ключа сессия недоступна, но остальные обработчики продолжают работу.
      Reflect.set(ctx, property, undefined);
      return next();
    }

    // Внутри процесса события одной сессии выполняются по очереди и не затирают изменения.
    return executor.run(key, async () => {
      const value = await store.get(key) ?? createSession(ctx);
      Reflect.set(ctx, property, value);

      try {
        return await next();
      } finally {
        // Сохраняем изменения session, даже если следующий обработчик завершился с ошибкой.
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
