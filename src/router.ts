import { Composer } from './composer';
import type { Middleware, MiddlewareObj } from './middleware';
import { Context } from './context';

type NonemptyReadonlyArray<T> = readonly [T, ...T[]];

/** Return value of the routing function: identifies a handler and optional state patch. */
type RouteResult = {
  route: string;
  /** Optional state values to merge into `ctx.state`. */
  state?: Record<string | symbol, unknown>;
};

type RouteFn<C extends Context> = (ctx: C) => RouteResult | null;

/**
 * Route-based middleware dispatcher.
 *
 * @example
 * const router = new Router<MyCtx>((ctx) => {
 *   if (ctx.updateType === 'message_created') return { route: 'message' }
 *   return null
 * })
 * router.on('message', (ctx) => ctx.reply('got a message'))
 * router.otherwise((ctx) => ctx.reply('unknown update'))
 * bot.use(router)
 */
export class Router<C extends Context> implements MiddlewareObj<C> {
  private otherwiseHandler: Middleware<C> = Composer.passThru<C>();

  constructor(
    private readonly routeFn: RouteFn<C>,
    public readonly handlers = new Map<string, Middleware<C>>(),
  ) {
    if (typeof routeFn !== 'function') {
      throw new Error('Router: routing function is required');
    }
  }

  /** Register a handler for the given route name. */
  on(route: string, ...fns: NonemptyReadonlyArray<Middleware<C>>) {
    if (fns.length === 0) {
      throw new TypeError('Router.on: at least one handler is required');
    }
    this.handlers.set(route, Composer.compose([...fns]));
    return this;
  }

  /** Fallback handler used when no route matches or `routeFn` returns `null`. */
  otherwise(...fns: NonemptyReadonlyArray<Middleware<C>>) {
    if (fns.length === 0) {
      throw new TypeError('Router.otherwise: at least one handler is required');
    }
    this.otherwiseHandler = Composer.compose([...fns]);
    return this;
  }

  middleware() {
    return Composer.lazy<C>((ctx) => {
      const result = this.routeFn(ctx);
      if (result == null) {
        return this.otherwiseHandler;
      }
      if (result.state) {
        Object.assign(ctx.state, result.state);
      }
      return this.handlers.get(result.route) ?? this.otherwiseHandler;
    });
  }
}
