import { Context } from './context';

type MaybePromise<T> = T | Promise<T>;

export type NextFn = () => Promise<void>;

export type MiddlewareFn<Ctx extends Context> = (
  ctx: Ctx,
  next: NextFn,
) => MaybePromise<unknown>;

export interface MiddlewareObj<Ctx extends Context> {
  middleware: () => MiddlewareFn<Ctx>;
}

export type Middleware<Ctx extends Context> = MiddlewareFn<Ctx> | MiddlewareObj<Ctx>;
