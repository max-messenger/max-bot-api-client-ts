import type { Context } from './context';

type MaybePromise<T> = T | Promise<T>;

/** Continues the onion chain and resolves when all downstream work completes. */
export type NextFn = () => Promise<void>;

/** A middleware may be synchronous, but async work must be returned or awaited. */
export type MiddlewareFn<Ctx extends Context> = (
  ctx: Ctx,
  next: NextFn,
) => MaybePromise<unknown>;

export interface MiddlewareObj<Ctx extends Context> {
  /** Allows stateful components such as Composer and ConversationEngine in `use()`. */
  middleware: () => MiddlewareFn<Ctx>;
}

/** Common input accepted by every composition API in the framework. */
export type Middleware<Ctx extends Context> = MiddlewareFn<Ctx> | MiddlewareObj<Ctx>;
