import type { Guard, MaybeArray, MaybePromise } from '../core/types';
import type { UpdateType } from '../core/network/api';

import type {
  Middleware, MiddlewareFn, MiddlewareObj, NextFn,
} from './middleware';

import { Context, type FilteredContext } from './context';
import { createdMessageBodyHas } from './filters';
import {
  branch as branchMiddleware,
  catchMiddleware,
  compose as composeMiddleware,
  concat as concatMiddleware,
  drop as dropMiddleware,
  flatten as flattenMiddleware,
  fork as forkMiddleware,
  lazy as lazyMiddleware,
  optional as optionalMiddleware,
  pass as passMiddleware,
  passThru as passThruMiddleware,
  tap as tapMiddleware,
} from './composition';
import type { AsyncPredicate, Predicate } from './composition';
import { dispatch as dispatchMiddleware } from './dispatch';
import type { DispatchResult } from './dispatch';
import { extractTextFromMessage, normalizeTriggers } from './triggers';
import type { TriggerFn, Triggers } from './triggers';

export type {
  AsyncPredicate, DispatchResult, Predicate, TriggerFn, Triggers,
};

type UpdateFilter<Ctx extends Context> = UpdateType | Guard<Ctx['update']>;

/**
 * Builds an onion-style middleware chain. Each middleware decides whether and
 * when the rest of the chain runs by calling `next()`.
 */
export class Composer<Ctx extends Context> implements MiddlewareObj<Ctx> {
  private handler: MiddlewareFn<Ctx>;

  constructor(...middlewares: Array<Middleware<Ctx>>) {
    this.handler = Composer.compose(middlewares);
  }

  middleware() {
    return this.handler;
  }

  use(...middlewares: Array<Middleware<Ctx>>) {
    this.handler = Composer.compose([this.handler, ...middlewares]);
    return this;
  }

  on<Filter extends UpdateType | Guard<Ctx['update']>>(
    filters: MaybeArray<Filter>,
    ...middlewares: Array<Middleware<FilteredContext<Ctx, Filter>>>
  ) {
    return this.use(this.filter(filters, ...middlewares));
  }

  command(
    commands: Triggers<FilteredContext<Ctx, 'message_created'>>,
    ...middlewares: Array<Middleware<FilteredContext<Ctx, 'message_created'>>>
  ) {
    const normalizedTriggers = normalizeTriggers(commands);
    const filter = createdMessageBodyHas('text');
    const handler = Composer.compose(middlewares);

    return this.use(this.filter(filter, (ctx, next) => {
      const text = extractTextFromMessage(ctx.message, ctx.myId)!;
      // A command name must never match ordinary text such as "ping".
      if (!text.startsWith('/')) return next();

      // Arguments are not split yet: `/name value` is passed to triggers as
      // `name value`. Adding command/payload/args parsing is a separate API step.
      const command = text.slice(1);
      for (const trigger of normalizedTriggers) {
        const match = trigger(command, ctx);
        if (match !== null) {
          ctx.match = match;
          return handler(ctx, next);
        }
      }

      return next();
    }));
  }

  hears(
    triggers: Triggers<FilteredContext<Ctx, 'message_created'>>,
    ...middlewares: Array<Middleware<FilteredContext<Ctx, 'message_created'>>>
  ) {
    const normalizedTriggers = normalizeTriggers(triggers);
    const filter = createdMessageBodyHas('text');
    const handler = Composer.compose(middlewares);

    return this.use(this.filter(filter, (ctx, next) => {
      const text = extractTextFromMessage(ctx.message, ctx.myId)!;

      for (const trigger of normalizedTriggers) {
        const match = trigger(text, ctx);
        if (match !== null) {
          ctx.match = match;
          return handler(ctx, next);
        }
      }

      return next();
    }));
  }

  action(
    triggers: Triggers<FilteredContext<Ctx, 'message_callback'>>,
    ...middlewares: Array<Middleware<FilteredContext<Ctx, 'message_callback'>>>
  ) {
    const normalizedTriggers = normalizeTriggers(triggers);
    const handler = Composer.compose(middlewares);

    return this.use(this.filter('message_callback', (ctx, next) => {
      const { payload } = ctx.update.callback;
      if (!payload) return next();

      for (const trigger of normalizedTriggers) {
        const match = trigger(payload, ctx);
        if (match !== null) {
          ctx.match = match;
          return handler(ctx, next);
        }
      }

      return next();
    }));
  }

  filter<Filter extends UpdateFilter<Ctx>>(
    filters: MaybeArray<Filter>,
    ...middlewares: Array<Middleware<FilteredContext<Ctx, Filter>>>
  ): MiddlewareFn<Ctx> {
    const handler = Composer.compose(middlewares);
    return (ctx, next) => {
      return ctx.has(filters) ? handler(ctx, next) : next();
    };
  }

  drop(predicate: Predicate<Ctx>) {
    return this.use(Composer.drop(predicate));
  }

  /** Runs middleware concurrently with the remaining chain and waits for both. */
  fork(middleware: Middleware<Ctx>) {
    return this.use(Composer.fork(middleware));
  }

  /** Runs middleware as a side effect, then continues the chain. */
  tap(middleware: Middleware<Ctx>) {
    return this.use(Composer.tap(middleware));
  }

  lazy(factory: (ctx: Ctx) => MaybePromise<Middleware<Ctx>>) {
    return this.use(Composer.lazy(factory));
  }

  branch(
    predicate: boolean | Predicate<Ctx>,
    trueMiddleware: Middleware<Ctx>,
    falseMiddleware: Middleware<Ctx>,
  ) {
    return this.use(Composer.branch(predicate, trueMiddleware, falseMiddleware));
  }

  optional(predicate: Predicate<Ctx>, ...middlewares: Array<Middleware<Ctx>>) {
    return this.use(Composer.optional(predicate, ...middlewares));
  }

  dispatch<Handlers extends Record<PropertyKey, Middleware<Ctx>>>(
    route: (
      ctx: Ctx,
    ) => MaybePromise<DispatchResult<keyof Handlers> | null | undefined>,
    handlers: Handlers,
    fallback: Middleware<Ctx> = Composer.passThru<Ctx>(),
  ) {
    return this.use(Composer.dispatch(route, handlers, fallback));
  }

  help(...middlewares: Array<Middleware<FilteredContext<Ctx, 'message_created'>>>) {
    return this.command('help', ...middlewares);
  }

  settings(...middlewares: Array<Middleware<FilteredContext<Ctx, 'message_created'>>>) {
    return this.command('settings', ...middlewares);
  }

  static flatten<C extends Context>(middleware: Middleware<C>): MiddlewareFn<C> {
    return flattenMiddleware(middleware);
  }

  static unwrap<C extends Context>(middleware: Middleware<C>): MiddlewareFn<C> {
    return Composer.flatten(middleware);
  }

  static concat<C extends Context>(
    first: MiddlewareFn<C>,
    andThen: MiddlewareFn<C>,
  ): MiddlewareFn<C> {
    return concatMiddleware(first, andThen);
  }

  static pass<C extends Context>(ctx: C, next: NextFn) {
    return passMiddleware(ctx, next);
  }

  static passThru<C extends Context = Context>(): MiddlewareFn<C> {
    return passThruMiddleware();
  }

  static compose<C extends Context>(middlewares: Array<Middleware<C>>): MiddlewareFn<C> {
    return composeMiddleware(middlewares);
  }

  static fork<C extends Context>(middleware: Middleware<C>): MiddlewareFn<C> {
    return forkMiddleware(middleware);
  }

  static tap<C extends Context>(middleware: Middleware<C>): MiddlewareFn<C> {
    return tapMiddleware(middleware);
  }

  static lazy<C extends Context>(
    factory: (ctx: C) => MaybePromise<Middleware<C>>,
  ): MiddlewareFn<C> {
    return lazyMiddleware(factory);
  }

  static log(
    logger: (message: string) => void,
  ): MiddlewareFn<Context> {
    return (ctx, next) => {
      logger(JSON.stringify(ctx.update, null, 2));
      return next();
    };
  }

  static catch<C extends Context>(
    errorHandler: (error: unknown, ctx: C) => MaybePromise<void>,
    ...middlewares: Array<Middleware<C>>
  ): MiddlewareFn<C> {
    return catchMiddleware(errorHandler, ...middlewares);
  }

  static branch<C extends Context>(
    predicate: boolean | Predicate<C>,
    trueMiddleware: Middleware<C>,
    falseMiddleware: Middleware<C>,
  ): MiddlewareFn<C> {
    return branchMiddleware(predicate, trueMiddleware, falseMiddleware);
  }

  static optional<C extends Context>(
    predicate: Predicate<C>,
    ...middlewares: Array<Middleware<C>>
  ): MiddlewareFn<C> {
    return optionalMiddleware(predicate, ...middlewares);
  }

  static drop<C extends Context>(predicate: Predicate<C>): MiddlewareFn<C> {
    return dropMiddleware(predicate);
  }

  static dispatch<
    C extends Context,
    Handlers extends Record<PropertyKey, Middleware<C>>,
  >(
    route: (
      ctx: C,
    ) => MaybePromise<DispatchResult<keyof Handlers> | null | undefined>,
    handlers: Handlers,
    fallback: Middleware<C> = Composer.passThru<C>(),
  ): MiddlewareFn<C> {
    return dispatchMiddleware(route, handlers, fallback);
  }

  static reply(...args: Parameters<Context['reply']>): MiddlewareFn<Context> {
    return (ctx) => ctx.reply(...args);
  }
}
