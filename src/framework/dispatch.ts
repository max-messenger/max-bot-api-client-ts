import type { MaybePromise } from '../core/types';
import type { Context } from './context';
import { flatten, passThru } from './composition';
import type { Middleware, MiddlewareFn } from './middleware';

/** A route may attach update-scoped values before its handler starts. */
export type DispatchResult<Key extends PropertyKey> =
  Key | { route: Key; state?: Record<string | symbol, unknown> };

const hasOwn = (value: object, key: PropertyKey) => {
  // Routes such as `toString` must not select properties inherited from Object.
  return Object.prototype.hasOwnProperty.call(value, key);
};

// State is copied onto a regular Context object. Reject prototype-related keys
// even when they arrive from parsed JSON or another untrusted route source.
const unsafeStateKeys = new Set(['__proto__', 'constructor', 'prototype']);

export function dispatch<
  C extends Context,
  Handlers extends Record<PropertyKey, Middleware<C>>,
>(
  route: (
    ctx: C,
  ) => MaybePromise<DispatchResult<keyof Handlers> | null | undefined>,
  handlers: Handlers,
  fallback: Middleware<C> = passThru<C>(),
): MiddlewareFn<C> {
  const fallbackHandler = flatten(fallback);
  return async (ctx, next) => {
    const result = await route(ctx);
    if (result === null || result === undefined) return fallbackHandler(ctx, next);
    const key = typeof result === 'object' ? result.route : result;
    if (typeof result === 'object' && result.state !== undefined) {
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
