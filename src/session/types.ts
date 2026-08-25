import type { Context } from '../core/context';
import type { MaybePromise } from '../core/types';

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
  /** Поле Context для состояния. По умолчанию — `session`. */
  property?: P;
  /** По умолчанию — `<user_id>:<chat_id>`; без ключа session для события не создаётся. */
  getSessionKey?: (ctx: C) => MaybePromise<string | null | undefined>;
  /**
   * По умолчанию данные хранятся в памяти и теряются при остановке процесса.
   * Для сохраняемого состояния подключите внешнее хранилище.
   */
  store?: SessionStore<S>;
  /** Создаёт состояние для нового ключа. По умолчанию возвращает пустой объект. */
  defaultSession?: (ctx: C) => S;
}

export interface SessionContext<S extends object = Record<string, unknown>> extends Context {
  session?: S;
}

export type SessionProperty<C extends Context> =
  (ExclusiveKeys<C, Context> & string) | 'session';
