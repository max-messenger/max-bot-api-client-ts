import type { Context } from '../../context';
import type { Middleware, MiddlewareFn } from '../../middleware';
import type { MaybePromise } from '../../types';
import { flatten, passThrough } from './composition';

/** Результат маршрутизации может дополнить `ctx.state` перед вызовом обработчика. */
export type DispatchResult<Key extends PropertyKey> =
  Key | { route: Key; state?: Record<string | symbol, unknown> };

const hasOwn = (value: object, key: PropertyKey) => {
  // Маршрут должен совпадать с явно заданным ключом, а не с унаследованным свойством.
  return Object.prototype.hasOwnProperty.call(value, key);
};

// Запрещаем ключи, которые могут изменить прототип Context.
const unsafeStateKeys = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Выбирает обработчик по результату `route`.
 * Для пустого или неизвестного маршрута вызывает `fallback`.
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
