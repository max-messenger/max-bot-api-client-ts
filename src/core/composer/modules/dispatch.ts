import type { MaybePromise } from '../../types';
import type { Context } from '../../context';
import { flatten, passThrough } from './composition';
import type { Middleware, MiddlewareFn } from '../../middleware';

/** Маршрут может добавить временные значения в `ctx.state` перед обработчиком. */
export type DispatchResult<Key extends PropertyKey> =
  Key | { route: Key; state?: Record<string | symbol, unknown> };

const hasOwn = (value: object, key: PropertyKey) => {
  // Маршрут `toString` не должен выбирать свойство, унаследованное от Object.
  return Object.prototype.hasOwnProperty.call(value, key);
};

// Эти ключи могли бы изменить прототип Context при копировании внешних данных.
const unsafeStateKeys = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Выбирает middleware по результату route.
 * Неизвестный или пустой маршрут обрабатывает fallback.
 */
export function dispatch<
  C extends Context,
  Handlers extends Record<PropertyKey, Middleware<C>>,
>(
  route: (
    ctx: C,
  ) => MaybePromise<DispatchResult<keyof Handlers> | null | undefined>,
  handlers: Handlers,
  fallback: Middleware<C> = passThrough<C>(),
): MiddlewareFn<C> {
  const fallbackHandler = flatten(fallback);
  return async (ctx, next) => {
    const result = await route(ctx);
    if (result == null) return fallbackHandler(ctx, next);

    const isObject = typeof result === 'object';
    const key = isObject ? result.route : result;

    if (isObject && result.state !== undefined) {
      for (const stateKey of Reflect.ownKeys(result.state)) {
        if (typeof stateKey === 'string' && unsafeStateKeys.has(stateKey)) {
          throw new TypeError(`Unsafe context state key "${stateKey}"`);
        }
        ctx.state[stateKey] = result.state[stateKey];
      }
    }

    const selected = hasOwn(handlers, key) ? handlers[key] : undefined;
    return selected === undefined
      ? fallbackHandler(ctx, next)
      : flatten(selected)(ctx, next);
  };
}
