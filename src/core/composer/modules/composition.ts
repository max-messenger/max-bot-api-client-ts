import type { Context } from '../../context';
import type {
  Middleware, MiddlewareFn, MiddlewareList, NextFn,
} from '../../middleware';
import type { MaybePromise } from '../../types';

export type Predicate<T> = (value: T) => MaybePromise<boolean>;

export type AsyncPredicate<T> = (value: T) => Promise<boolean>;

const noop = () => Promise.resolve();

export const flatten = <C extends Context>(middleware: Middleware<C>): MiddlewareFn<C> => {
  // Для объекта вызываем middleware() при каждом событии, чтобы учитывать
  // изменения, сделанные после сборки цепочки.
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
      // Повторный `next()` ещё раз запустил бы следующие обработчики.
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

/** Одновременно запускает переданный обработчик и оставшуюся цепочку. */
export const fork = <C extends Context>(middleware: Middleware<C>): MiddlewareFn<C> => {
  const handler = flatten(middleware);
  return async (ctx, next) => {
    // Если одна из веток завершится с ошибкой, fork также завершится с ошибкой.
    await Promise.all([handler(ctx, noop), next()]);
  };
};

/** Выполняет дополнительное действие перед переходом к `next()`. */
export const tap = <C extends Context>(middleware: Middleware<C>): MiddlewareFn<C> => {
  const handler = flatten(middleware);
  return async (ctx, next) => {
    // Переданный обработчик получает `next()` без продолжения и не запускает основную цепочку.
    await handler(ctx, noop);
    await next();
  };
};

/** Вызывает `factory` для каждого события и выполняет возвращённый обработчик. */
export const lazy = <C extends Context>(
  factory: (ctx: C) => MaybePromise<Middleware<C>>,
): MiddlewareFn<C> => {
  if (typeof factory !== 'function') throw new TypeError('Factory must be a function');
  return async (ctx, next) => {
    // Выбор может зависеть от сессии, прав пользователя и других данных Context.
    const middleware = await factory(ctx);
    return flatten(middleware)(ctx, next);
  };
};

/** Передаёт ошибку из указанной цепочки в `errorHandler`. */
export const catchMiddleware = <C extends Context>(
  errorHandler: (error: unknown, ctx: C) => MaybePromise<void>,
  ...middlewares: MiddlewareList<C>
): MiddlewareFn<C> => {
  const handler = compose(middlewares);
  return async (ctx, next) => {
    try {
      await handler(ctx, next);
    } catch (error) {
      // Если errorHandler выбросит новую ошибку, она будет передана вызывающему коду.
      await errorHandler(error, ctx);
    }
  };
};

/** Выполняет одну из двух веток по синхронному или асинхронному условию. */
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

/** Выполняет переданную цепочку при true и сразу вызывает `next()` при false. */
export const optional = <C extends Context>(
  predicate: Predicate<C>,
  ...middlewares: MiddlewareList<C>
): MiddlewareFn<C> => branch(predicate, compose(middlewares), passThrough<C>());

/** Прекращает обработку события при true и вызывает `next()` при false. */
export const drop = <C extends Context>(predicate: Predicate<C>): MiddlewareFn<C> => {
  return branch(predicate, noop, passThrough<C>());
};
