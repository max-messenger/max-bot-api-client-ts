import type { MaybePromise } from '../../types';
import type { Context } from '../../context';
import type {
  Middleware, MiddlewareFn, MiddlewareList, NextFn,
} from '../../middleware';

export type Predicate<T> = (value: T) => MaybePromise<boolean>;

export type AsyncPredicate<T> = (value: T) => Promise<boolean>;

const noop = () => Promise.resolve();

export const flatten = <C extends Context>(middleware: Middleware<C>): MiddlewareFn<C> => {
  // Объект запрашивается на каждом update, поэтому его обработчик можно менять
  // после сборки цепочки.
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
      // Повторный next запустил бы следующие обработчики и их побочные эффекты ещё раз.
      if (nextCalled) throw new Error('`next` already called before!');
      nextCalled = true;
      await andThen(ctx, next);
    });
  };
};

export const pass = <C extends Context>(_ctx: C, next: NextFn) => next();

export const passThrough = <C extends Context = Context>(): MiddlewareFn<C> => pass;

export const compose = <C extends Context>(
  middlewares: MiddlewareList<C>,
): MiddlewareFn<C> => {
  if (!Array.isArray(middlewares)) throw new TypeError('Middlewares must be an array');
  if (middlewares.length === 0) return pass;
  return middlewares.map(flatten).reduce(concat);
};

/** Параллельно выполняет отдельную ветку и `next()`, ожидая завершения обеих. */
export const fork = <C extends Context>(middleware: Middleware<C>): MiddlewareFn<C> => {
  const handler = flatten(middleware);
  return async (ctx, next) => {
    // Обе ветки ожидаются: фоновая работа могла бы пережить ctx/session и обойти обработку ошибок.
    await Promise.all([handler(ctx, noop), next()]);
  };
};

/** Выполняет побочную ветку до `next()` и не даёт ей продолжить основную цепочку. */
export const tap = <C extends Context>(middleware: Middleware<C>): MiddlewareFn<C> => {
  const handler = flatten(middleware);
  return async (ctx, next) => {
    // Побочная ветка получает закрытый next и не может повторно запустить основную цепочку.
    await handler(ctx, noop);
    await next();
  };
};

/** Получает middleware из factory отдельно для каждого обрабатываемого Context. */
export const lazy = <C extends Context>(
  factory: (ctx: C) => MaybePromise<Middleware<C>>,
): MiddlewareFn<C> => {
  if (typeof factory !== 'function') throw new TypeError('Factory must be a function');
  return async (ctx, next) => {
    // Middleware выбирается для каждого update и может зависеть от session, прав и других данных.
    const middleware = await factory(ctx);
    return flatten(middleware)(ctx, next);
  };
};

/** Передаёт ошибку из обёрнутой цепочки пользовательскому обработчику. */
export const catchMiddleware = <C extends Context>(
  errorHandler: (error: unknown, ctx: C) => MaybePromise<void>,
  ...middlewares: MiddlewareList<C>
): MiddlewareFn<C> => {
  const handler = compose(middlewares);
  return async (ctx, next) => {
    try {
      await handler(ctx, next);
    } catch (error) {
      // Ошибка самого errorHandler передаётся обработчику Bot, а не скрывается здесь.
      await errorHandler(error, ctx);
    }
  };
};

/** Выбирает и выполняет одну из двух веток по синхронному или асинхронному условию. */
export const branch = <C extends Context>(
  predicate: boolean | Predicate<C>,
  onTrue: Middleware<C>,
  onFalse: Middleware<C>,
): MiddlewareFn<C> => {
  if (typeof predicate === 'boolean') {
    return flatten(predicate ? onTrue : onFalse);
  }
  return lazy(async (ctx) => {
    return await predicate(ctx) ? onTrue : onFalse;
  });
};

/** Выполняет переданную цепочку при true и вызывает `next()` при false. */
export const optional = <C extends Context>(
  predicate: Predicate<C>,
  ...middlewares: MiddlewareList<C>
): MiddlewareFn<C> => branch(predicate, compose(middlewares), passThrough<C>());

/** Завершает обработку update при true и вызывает `next()` при false. */
export const drop = <C extends Context>(predicate: Predicate<C>): MiddlewareFn<C> => {
  return branch(predicate, noop, passThrough<C>());
};
