import createDebug from 'debug';
import { Context } from './context';
import type { MaybePromise } from './core/helpers/types';
import type { MiddlewareFn } from './middleware';

const debug = createDebug('max:session');

// ─── Store interfaces ─────────────────────────────────────────────────────────

export interface SyncSessionStore<T> {
  get: (name: string) => T | undefined;
  set: (name: string, value: T) => void;
  delete: (name: string) => void;
}

export interface AsyncSessionStore<T> {
  get: (name: string) => Promise<T | undefined>;
  set: (name: string, value: T) => Promise<unknown>;
  delete: (name: string) => Promise<unknown>;
}

export type SessionStore<T> = SyncSessionStore<T> | AsyncSessionStore<T>;

// ─── Options ──────────────────────────────────────────────────────────────────

type ExclusiveKeys<A, B> = keyof Omit<A, keyof B>;

interface SessionOptions<S, C extends Context, P extends string> {
  /**
   * Property name on `ctx` where the session will be stored.
   * Defaults to `"session"` → available as `ctx.session`.
   */
  property?: P;
  /** Function to compute the session key for a given context. */
  getSessionKey?: (ctx: C) => MaybePromise<string | undefined>;
  /** Storage backend. Defaults to an in-memory store. */
  store?: SessionStore<S>;
  /** Factory for creating a fresh session when none exists. */
  defaultSession?: (ctx: C) => S;
}

export interface SessionContext<S extends object> extends Context {
  session?: S;
}

// ─── Middleware factory ───────────────────────────────────────────────────────

/**
 * Returns middleware that adds `ctx.session` for storing per-user state.
 *
 * Default key: `"${user_id}:${chat_id}"`. When either is missing the session
 * property is set to `undefined` and the update is passed through unchanged.
 *
 * @example
 * interface MySession { count: number }
 * type MyCtx = Context & { session: MySession }
 *
 * const bot = new Bot<MyCtx>(token)
 * bot.use(session<MySession, MyCtx>({ defaultSession: () => ({ count: 0 }) }))
 * bot.on('message_created', (ctx) => { ctx.session.count++ })
 */
export function session<
  S extends NonNullable<C[P]>,
  C extends Context & { [key in P]?: C[P] },
  P extends (ExclusiveKeys<C, Context> & string) | 'session' = 'session',
>(options?: SessionOptions<S, C, P>): MiddlewareFn<C> {
  const prop = options?.property ?? ('session' as P);
  const getSessionKey = options?.getSessionKey ?? defaultGetSessionKey as (ctx: C) => MaybePromise<string | undefined>;
  const store: SessionStore<S> = options?.store ?? new MemorySessionStore<S>();

  // In-memory cache shared across concurrent updates for the same key.
  const cache = new Map<string, { ref?: S; counter: number }>();
  // Deduplicates simultaneous store.get() calls for the same key.
  const concurrents = new Map<string, MaybePromise<S | undefined>>();

  return async (ctx, next) => {
    const updId = `${ctx.update.update_type}:${ctx.update.timestamp}`;
    let released = false;

    function releaseChecks() {
      if (released && process.env.EXPERIMENTAL_SESSION_CHECKS) {
        throw new Error(
          'Session was accessed after the middleware chain exhausted. '
          + "You're probably missing an `await` somewhere.",
        );
      }
    }

    const key = await getSessionKey(ctx);
    if (!key) {
      (ctx as Record<string, unknown>)[prop] = undefined;
      return await next();
    }

    let cached = cache.get(key);
    if (cached) {
      debug(`(${updId}) found cached session, reusing`);
      ++cached.counter;
    } else {
      debug(`(${updId}) cache miss`);
      let promise = concurrents.get(key);
      if (!promise) {
        debug(`(${updId}) fetching from store`);
        promise = store.get(key);
      } else {
        debug(`(${updId}) reusing concurrent fetch`);
      }
      concurrents.set(key, promise);
      const upstream = await promise;
      concurrents.delete(key);

      const existing = cache.get(key);
      if (existing) {
        existing.counter++;
        cached = existing;
      } else {
        cached = { ref: upstream ?? options?.defaultSession?.(ctx), counter: 1 };
        cache.set(key, cached);
      }
    }

    const c = cached;
    let touched = false;

    Object.defineProperty(ctx, prop, {
      configurable: true,
      enumerable: true,
      get() {
        releaseChecks();
        touched = true;
        return c.ref;
      },
      set(value: S) {
        releaseChecks();
        touched = true;
        c.ref = value;
      },
    });

    try {
      await next();
      released = true;
    } finally {
      if (--c.counter === 0) {
        debug(`(${updId}) refcount=0, purging cache entry`);
        cache.delete(key);
      }
      if (touched) {
        if (c.ref == null) {
          debug(`(${updId}) session deleted, removing from store`);
          await store.delete(key);
        } else {
          debug(`(${updId}) session touched, updating store`);
          await store.set(key, c.ref);
        }
      }
    }
  };
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

function defaultGetSessionKey(ctx: Context): string | undefined {
  const userId = ctx.user?.user_id;
  const chatId = ctx.chatId;
  if (userId == null || chatId == null) return undefined;
  return `${userId}:${chatId}`;
}

// ─── In-memory store with optional TTL ────────────────────────────────────────

export class MemorySessionStore<T> implements SyncSessionStore<T> {
  private readonly store = new Map<string, { session: T; expires: number }>();

  /** @param ttl Milliseconds until a session entry expires. Defaults to `Infinity`. */
  constructor(private readonly ttl = Infinity) {}

  get(name: string): T | undefined {
    const entry = this.store.get(name);
    if (entry == null) return undefined;
    if (entry.expires < Date.now()) {
      this.delete(name);
      return undefined;
    }
    return entry.session;
  }

  set(name: string, value: T): void {
    this.store.set(name, { session: value, expires: Date.now() + this.ttl });
  }

  delete(name: string): void {
    this.store.delete(name);
  }
}
