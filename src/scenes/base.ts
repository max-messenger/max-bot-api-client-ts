import { Composer } from '../composer';
import type { Middleware, MiddlewareFn } from '../middleware';
import type { Context } from '../context';

export interface SceneOptions<C extends Context> {
  /** Auto-leave TTL in seconds. */
  ttl?: number;
  handlers?: ReadonlyArray<MiddlewareFn<C>>;
  enterHandlers?: ReadonlyArray<MiddlewareFn<C>>;
  leaveHandlers?: ReadonlyArray<MiddlewareFn<C>>;
}

/**
 * A named scene that participates in the middleware composition system.
 *
 * Extend this class or use it directly.  Register instances with `Stage`.
 */
export class BaseScene<C extends Context = Context> extends Composer<C> {
  readonly id: string;

  ttl?: number;

  enterHandler: MiddlewareFn<C>;

  leaveHandler: MiddlewareFn<C>;

  constructor(id: string, options?: SceneOptions<C>) {
    const opts: Required<SceneOptions<C>> = {
      handlers: [],
      enterHandlers: [],
      leaveHandlers: [],
      ttl: undefined as unknown as number,
      ...options,
    };
    super(...(opts.handlers as Middleware<C>[]));
    this.id = id;
    this.ttl = opts.ttl;
    this.enterHandler = Composer.compose(opts.enterHandlers as Middleware<C>[]);
    this.leaveHandler = Composer.compose(opts.leaveHandlers as Middleware<C>[]);
  }

  /** Register handlers that run when the scene is entered. */
  enter(...fns: Array<Middleware<C>>) {
    this.enterHandler = Composer.compose([this.enterHandler, ...fns]);
    return this;
  }

  /** Register handlers that run when the scene is left. */
  leave(...fns: Array<Middleware<C>>) {
    this.leaveHandler = Composer.compose([this.leaveHandler, ...fns]);
    return this;
  }

  enterMiddleware(): MiddlewareFn<C> {
    return this.enterHandler;
  }

  leaveMiddleware(): MiddlewareFn<C> {
    return this.leaveHandler;
  }
}
