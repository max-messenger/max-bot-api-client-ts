import type { Guard, MaybeArray, MaybePromise } from './core/helpers/types';
import type { Message, UpdateType } from './core/network/api';

import type {
  Middleware, MiddlewareFn, MiddlewareObj, NextFn,
} from './middleware';

import { Context, type FilteredContext } from './context';
import { createdMessageBodyHas } from './filters';

/** Context-aware trigger function: receives matched string and context, returns match or null. */
export type TriggerFn<Ctx extends Context> = (value: string, ctx: Ctx) => RegExpExecArray | null;

export type Triggers<Ctx extends Context = Context> = MaybeArray<string | RegExp | TriggerFn<Ctx>>;

export type Predicate<T> = (t: T) => boolean;
export type AsyncPredicate<T> = (t: T) => Promise<boolean>;

type UpdateFilter<Ctx extends Context> = UpdateType | Guard<Ctx['update']>;

const noopAsync = () => Promise.resolve();

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
    command: Triggers<FilteredContext<Ctx, 'message_created'>>,
    ...middlewares: Array<Middleware<FilteredContext<Ctx, 'message_created'>>>
  ) {
    const normalizedTriggers = normalizeTriggers(command);
    const filterFn = createdMessageBodyHas('text');

    const handler = Composer.compose(middlewares);

    return this.use(this.filter(filterFn, (ctx, next) => {
      const text = extractTextFromMessage(ctx.message, ctx.myId)!;

      const cmd = text.slice(1);

      for (const trigger of normalizedTriggers) {
        const match = trigger(cmd, ctx as unknown as FilteredContext<Ctx, 'message_created'>);
        if (match) {
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
    const filterFn = createdMessageBodyHas('text');

    const handler = Composer.compose(middlewares);

    return this.use(this.filter(filterFn, (ctx, next) => {
      const text = extractTextFromMessage(ctx.message, ctx.myId)!;

      for (const trigger of normalizedTriggers) {
        const match = trigger(text, ctx as unknown as FilteredContext<Ctx, 'message_created'>);
        if (match) {
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
        const match = trigger(payload, ctx as unknown as FilteredContext<Ctx, 'message_callback'>);
        if (match) {
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

  /** Drops updates matching the predicate (they don't propagate further). */
  drop(predicate: Predicate<Ctx>) {
    return this.use(Composer.drop(predicate));
  }

  /** Runs middleware in the background without blocking the main chain. */
  fork(middleware: Middleware<Ctx>) {
    return this.use(Composer.fork(middleware));
  }

  /** Runs middleware as a side-effect: awaits it, then always calls next. */
  tap(middleware: Middleware<Ctx>) {
    return this.use(Composer.tap(middleware));
  }

  /** Lazily creates middleware from a factory function on each update. */
  lazy(factoryFn: (ctx: Ctx) => MaybePromise<Middleware<Ctx>>) {
    return this.use(Composer.lazy(factoryFn));
  }

  /** Runs trueMiddleware or falseMiddleware based on predicate. */
  branch(
    predicate: boolean | Predicate<Ctx> | AsyncPredicate<Ctx>,
    trueMiddleware: Middleware<Ctx>,
    falseMiddleware: Middleware<Ctx>,
  ) {
    return this.use(Composer.branch(predicate, trueMiddleware, falseMiddleware));
  }

  /** Runs middlewares only when predicate is true; otherwise passes through. */
  optional(
    predicate: Predicate<Ctx> | AsyncPredicate<Ctx>,
    ...middlewares: Array<Middleware<Ctx>>
  ) {
    return this.use(Composer.optional(predicate, ...middlewares));
  }

  /** Dispatches to one of the provided handlers based on a routing function. */
  dispatch<Handlers extends Record<string | number | symbol, Middleware<Ctx>>>(
    routeFn: (ctx: Ctx) => MaybePromise<keyof Handlers>,
    handlers: Handlers,
  ) {
    return this.use(Composer.dispatch(routeFn, handlers));
  }

  /** Shorthand for `command('help', ...middlewares)`. */
  help(...middlewares: Array<Middleware<FilteredContext<Ctx, 'message_created'>>>) {
    return this.command('help', ...middlewares);
  }

  /** Shorthand for `command('settings', ...middlewares)`. */
  settings(...middlewares: Array<Middleware<FilteredContext<Ctx, 'message_created'>>>) {
    return this.command('settings', ...middlewares);
  }

  // ─── Static factories ────────────────────────────────────────────────

  static flatten<C extends Context>(mw: Middleware<C>): MiddlewareFn<C> {
    return typeof mw === 'function'
      ? mw
      : (ctx, next) => mw.middleware()(ctx, next);
  }

  /** Alias of `flatten` — unwraps a Middleware into a plain MiddlewareFn. */
  static unwrap<C extends Context>(mw: Middleware<C>): MiddlewareFn<C> {
    return Composer.flatten(mw);
  }

  static concat<C extends Context>(
    first: MiddlewareFn<C>,
    andThen: MiddlewareFn<C>,
  ): MiddlewareFn<C> {
    return async (ctx, next) => {
      let nextCalled = false;
      await first(ctx, async () => {
        if (nextCalled) {
          throw new Error('`next` already called before!');
        }
        nextCalled = true;
        await andThen(ctx, next);
      });
    };
  }

  static pass<C extends Context>(_ctx: C, next: NextFn) {
    return next();
  }

  /** A no-op pass-through middleware (alias of `pass` as a factory). */
  static passThru<C extends Context = Context>(): MiddlewareFn<C> {
    return (_ctx, next) => next();
  }

  static compose<C extends Context>(middlewares: Array<Middleware<C>>): MiddlewareFn<C> {
    if (!Array.isArray(middlewares)) {
      throw new Error('Middlewares must be an array');
    }
    if (middlewares.length === 0) {
      return Composer.pass;
    }
    return middlewares.map(Composer.flatten).reduce(Composer.concat);
  }

  /** Runs middleware in the background (fire-and-forget). */
  static fork<C extends Context>(middleware: Middleware<C>): MiddlewareFn<C> {
    const handler = Composer.flatten(middleware);
    return async (ctx, next) => {
      await Promise.all([handler(ctx, noopAsync), next()]);
    };
  }

  /** Runs middleware as a side-effect then always continues. */
  static tap<C extends Context>(middleware: Middleware<C>): MiddlewareFn<C> {
    const handler = Composer.flatten(middleware);
    return (ctx, next) =>
      Promise.resolve(handler(ctx, noopAsync)).then(() => next());
  }

  /** Creates middleware lazily from a factory called once per update. */
  static lazy<C extends Context>(
    factoryFn: (ctx: C) => MaybePromise<Middleware<C>>,
  ): MiddlewareFn<C> {
    if (typeof factoryFn !== 'function') {
      throw new Error('Argument must be a function');
    }
    return (ctx, next) =>
      Promise.resolve(factoryFn(ctx)).then((mw) =>
        Composer.flatten(mw)(ctx, next),
      );
  }

  /** Logs each update as JSON using `logFn` (defaults to `console.log`). */
  static log(logFn: (s: string) => void = console.log): MiddlewareFn<Context> {
    return (ctx, next) => {
      logFn(JSON.stringify(ctx.update, null, 2));
      return next();
    };
  }

  /**
   * Wraps `fns` in a try/catch; calls `errorHandler` on rejection.
   * Execution continues normally after error handling.
   */
  static catch<C extends Context>(
    errorHandler: (err: unknown, ctx: C) => MaybePromise<void>,
    ...fns: Array<Middleware<C>>
  ): MiddlewareFn<C> {
    const handler = Composer.compose(fns);
    return (ctx, next) =>
      Promise.resolve(handler(ctx, next)).catch((err: unknown) =>
        errorHandler(err, ctx),
      );
  }

  /** Runs trueMiddleware or falseMiddleware based on a (possibly async) predicate. */
  static branch<C extends Context>(
    predicate: boolean | Predicate<C> | AsyncPredicate<C>,
    trueMiddleware: Middleware<C>,
    falseMiddleware: Middleware<C>,
  ): MiddlewareFn<C> {
    if (typeof predicate !== 'function') {
      return Composer.flatten(predicate ? trueMiddleware : falseMiddleware);
    }
    return Composer.lazy<C>((ctx) =>
      Promise.resolve(predicate(ctx)).then((value) =>
        value ? trueMiddleware : falseMiddleware,
      ),
    );
  }

  /** Runs middlewares when predicate is truthy; otherwise passes through. */
  static optional<C extends Context>(
    predicate: Predicate<C> | AsyncPredicate<C>,
    ...fns: Array<Middleware<C>>
  ): MiddlewareFn<C> {
    return Composer.branch(predicate, Composer.compose(fns), Composer.passThru<C>());
  }

  /** Drops matching updates (does NOT call next). */
  static drop<C extends Context>(predicate: Predicate<C>): MiddlewareFn<C> {
    return Composer.branch(predicate, noopAsync, Composer.passThru<C>());
  }

  /** Routes to one of the `handlers` based on the key returned by `routeFn`. */
  static dispatch<
    C extends Context,
    Handlers extends Record<string | number | symbol, Middleware<C>>,
  >(
    routeFn: (ctx: C) => MaybePromise<keyof Handlers>,
    handlers: Handlers,
  ): Middleware<C> {
    return Composer.lazy<C>((ctx) =>
      Promise.resolve(routeFn(ctx)).then((key) => handlers[key]),
    );
  }

  /** Creates a reply middleware with fixed arguments. */
  static reply(...args: Parameters<Context['reply']>): MiddlewareFn<Context> {
    return (ctx) => ctx.reply(...args);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const normalizeTriggers = <Ctx extends Context>(triggers: Triggers<Ctx>) => {
  return (Array.isArray(triggers) ? triggers : [triggers]).map((trigger) => {
    if (typeof trigger === 'function') {
      return trigger;
    }
    if (trigger instanceof RegExp) {
      return (value = '', _ctx: Ctx) => {
        trigger.lastIndex = 0;
        return trigger.exec(value.trim());
      };
    }
    const regex = new RegExp(`^${trigger}$`);
    return (value: string, _ctx: Ctx) => regex.exec(value.trim());
  });
};

const extractTextFromMessage = (message: Message, myId?: number) => {
  const { text } = message.body;

  const mention = message.body.markup?.find((m) => {
    return m.type === 'user_mention';
  });

  if (
    mention
    && mention.from === 0
    && mention.user_id === myId
  ) {
    return text?.slice(mention.length).trim();
  }

  return text;
};
