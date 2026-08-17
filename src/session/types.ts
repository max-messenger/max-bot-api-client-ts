import type { MaybePromise } from '../core/types';
import type { Context } from '../framework/context';

export interface SyncSessionStore<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  delete(key: string): void;
}

export interface AsyncSessionStore<T> {
  get(key: string): Promise<T | undefined>;
  set(key: string, value: T): Promise<unknown>;
  delete(key: string): Promise<unknown>;
}

export type SessionStore<T> = SyncSessionStore<T> | AsyncSessionStore<T>;

type ExclusiveKeys<A, B> = keyof Omit<A, keyof B>;

export interface SessionOptions<S, C extends Context, P extends string> {
  /** Context property used for the session. Defaults to `session`. */
  property?: P;
  /** Defaults to `<user_id>:<chat_id>`. Nullish keys disable the session. */
  getSessionKey?: (ctx: C) => MaybePromise<string | null | undefined>;
  /** Defaults to process-local memory storage. */
  store?: SessionStore<S>;
  /** Creates the value when the store has no session for the key. */
  defaultSession?: (ctx: C) => S;
}

export interface SessionContext<S extends object = Record<string, unknown>> extends Context {
  session?: S;
}

export type SessionProperty<C extends Context> =
  (ExclusiveKeys<C, Context> & string) | 'session';
