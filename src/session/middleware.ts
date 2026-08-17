import { KeyedExecutor } from '../core/keyed-executor';
import type { Context } from '../framework/context';
import type { MiddlewareFn } from '../framework/middleware';
import { MemorySessionStore } from './memory-store';
import type { SessionOptions, SessionProperty } from './types';

/** Adds persistent per-user/per-chat state to the middleware context. */
export function session<
  S extends NonNullable<C[P]>,
  C extends Context & { [key in P]?: C[P] },
  P extends SessionProperty<C> = 'session',
>(options: SessionOptions<S, C, P> = {}): MiddlewareFn<C> {
  const property = options.property ?? ('session' as P);
  if (['__proto__', 'constructor', 'prototype'].includes(property)) {
    throw new TypeError(`Unsafe session property "${property}"`);
  }
  const getSessionKey = options.getSessionKey ?? defaultGetSessionKey;
  const store = options.store ?? new MemorySessionStore<S>();
  const executor = new KeyedExecutor();

  return async (ctx, next) => {
    const key = await getSessionKey(ctx);
    if (key == null) {
      Reflect.set(ctx, property, undefined);
      return next();
    }

    // Serializing one key prevents lost writes between concurrent local updates.
    return executor.run(key, async () => {
      const value = await store.get(key) ?? options.defaultSession?.(ctx);
      Reflect.set(ctx, property, value);

      try {
        return await next();
      } finally {
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
