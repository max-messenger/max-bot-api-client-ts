import type { Context } from './context';

type MaybePromise<T> = T | Promise<T>;

/** Передаёт управление дальше по цепочке и ждёт завершения следующих обработчиков. */
export type NextFn = () => Promise<void>;

/** Middleware может быть синхронным, но асинхронную работу нужно вернуть или дождаться. */
export type MiddlewareFn<Ctx extends Context> = (
  ctx: Ctx,
  next: NextFn,
) => MaybePromise<unknown>;

export interface MiddlewareObj<Ctx extends Context> {
  /** Позволяет передавать компоненты с состоянием вроде Composer и ScenarioEngine в `use()`. */
  middleware: () => MiddlewareFn<Ctx>;
}

/** Общий тип обработчика, который принимает API композиции. */
export type Middleware<Ctx extends Context> = MiddlewareFn<Ctx> | MiddlewareObj<Ctx>;

/** Список middleware одного типа контекста. */
export type MiddlewareList<Ctx extends Context> = Array<Middleware<Ctx>>;
