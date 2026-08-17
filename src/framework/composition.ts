import type { MaybePromise } from '../core/types';
import type { Context } from './context';
import type {
  Middleware, MiddlewareFn, NextFn,
} from './middleware';

export type Predicate<T> = (value: T) => MaybePromise<boolean>;

export type AsyncPredicate<T> = (value: T) => Promise<boolean>;

const noop = () => Promise.resolve();

export const flatten = <C extends Context>(middleware: Middleware<C>): MiddlewareFn<C> => {
  // Middleware objects stay lazy: their current middleware is requested for
  // every update instead of being snapshotted while composing the chain.
  return typeof middleware === 'function'
    ? middleware
    : (ctx, next) => middleware.middleware()(ctx, next);
};

export const concat = <C extends Context>(
  first: MiddlewareFn<C>,
  andThen: MiddlewareFn<C>,
): MiddlewareFn<C> => {
  return async (ctx, next) => {
    let nextCalled = false;
    await first(ctx, async () => {
      // Calling next twice would execute downstream handlers twice and may
      // persist a session or send a reply more than once.
      if (nextCalled) throw new Error('`next` already called before!');
      nextCalled = true;
      await andThen(ctx, next);
    });
  };
};

export const pass = <C extends Context>(_ctx: C, next: NextFn) => next();

export const passThru = <C extends Context = Context>(): MiddlewareFn<C> => pass;

export const compose = <C extends Context>(
  middlewares: Array<Middleware<C>>,
): MiddlewareFn<C> => {
  if (!Array.isArray(middlewares)) throw new TypeError('Middlewares must be an array');
  if (middlewares.length === 0) return pass;
  return middlewares.map(flatten).reduce(concat);
};

export const fork = <C extends Context>(middleware: Middleware<C>): MiddlewareFn<C> => {
  const handler = flatten(middleware);
  return async (ctx, next) => {
    // Both branches are awaited intentionally. Fire-and-forget work could
    // outlive ctx/session and would bypass the bot's error boundary.
    await Promise.all([handler(ctx, noop), next()]);
  };
};

export const tap = <C extends Context>(middleware: Middleware<C>): MiddlewareFn<C> => {
  const handler = flatten(middleware);
  return async (ctx, next) => {
    // The side effect receives a closed chain so its own `next()` cannot run
    // the real downstream middleware. The real chain continues exactly once.
    await handler(ctx, noop);
    await next();
  };
};

export const lazy = <C extends Context>(
  factory: (ctx: C) => MaybePromise<Middleware<C>>,
): MiddlewareFn<C> => {
  if (typeof factory !== 'function') throw new TypeError('Factory must be a function');
  return async (ctx, next) => {
    // Resolve per update so the selected middleware may depend on user,
    // session, permissions, or any other context data.
    const middleware = await factory(ctx);
    return flatten(middleware)(ctx, next);
  };
};

export const catchMiddleware = <C extends Context>(
  errorHandler: (error: unknown, ctx: C) => MaybePromise<void>,
  ...middlewares: Array<Middleware<C>>
): MiddlewareFn<C> => {
  const handler = compose(middlewares);
  return async (ctx, next) => {
    try {
      await handler(ctx, next);
    } catch (error) {
      // Errors thrown by the error handler itself are deliberately allowed to
      // propagate to the bot-level handler instead of being swallowed.
      await errorHandler(error, ctx);
    }
  };
};

export const branch = <C extends Context>(
  predicate: boolean | Predicate<C>,
  trueMiddleware: Middleware<C>,
  falseMiddleware: Middleware<C>,
): MiddlewareFn<C> => {
  if (typeof predicate === 'boolean') {
    return flatten(predicate ? trueMiddleware : falseMiddleware);
  }
  return lazy(async (ctx) => {
    return await predicate(ctx) ? trueMiddleware : falseMiddleware;
  });
};

export const optional = <C extends Context>(
  predicate: Predicate<C>,
  ...middlewares: Array<Middleware<C>>
): MiddlewareFn<C> => branch(predicate, compose(middlewares), passThru<C>());

export const drop = <C extends Context>(predicate: Predicate<C>): MiddlewareFn<C> => {
  return branch(predicate, noop, passThru<C>());
};
