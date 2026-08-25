import type { Guard, MaybeArray, MaybePromise } from '../types';
import type { UpdateType } from '../network/api';

import type {
  Middleware, MiddlewareFn, MiddlewareList, MiddlewareObj, NextFn,
} from '../middleware';

import { Context, type FilteredContext } from '../context';
import { createdMessageBodyHas } from './modules/filters';
import * as ComposerMiddleware from './modules';
import type { AsyncPredicate, DispatchResult, Predicate } from './modules';
import { extractTextFromMessage, normalizeTriggers } from './modules/triggers';
import type { TriggerFn, Triggers } from './modules/triggers';

export type {
  AsyncPredicate, DispatchResult, Predicate, TriggerFn, Triggers,
};

type UpdateFilter<Ctx extends Context> = UpdateType | Guard<Ctx['update']>;

/** Собирает onion-цепочку, в которой middleware управляет продолжением через `next()`. */
export class Composer<Ctx extends Context> implements MiddlewareObj<Ctx> {
  private handler: MiddlewareFn<Ctx>;

  constructor(...middlewares: MiddlewareList<Ctx>) {
    this.handler = Composer.compose(middlewares);
  }

  /** Возвращает собранный обработчик для подключения к другой цепочке. */
  middleware() {
    return this.handler;
  }

  /** Добавляет middleware в конец текущей цепочки. */
  use(...middlewares: MiddlewareList<Ctx>) {
    this.handler = Composer.compose([this.handler, ...middlewares]);
    return this;
  }

  /** Выполняет middleware только для update указанных типов или guard-функций. */
  on<Filter extends UpdateType | Guard<Ctx['update']>>(
    filters: MaybeArray<Filter>,
    ...middlewares: MiddlewareList<FilteredContext<Ctx, Filter>>
  ) {
    return this.use(this.filter(filters, ...middlewares));
  }

  /** Выполняет middleware для команды в текстовом сообщении. */
  command(
    commands: Triggers<FilteredContext<Ctx, 'message_created'>>,
    ...middlewares: MiddlewareList<FilteredContext<Ctx, 'message_created'>>
  ) {
    const normalizedTriggers = normalizeTriggers(commands);
    const filter = createdMessageBodyHas('text');
    const handler = Composer.compose(middlewares);

    return this.use(this.filter(filter, (ctx, next) => {
      const text = extractTextFromMessage(ctx.message, ctx.myId)!;
      // Команда обязательно начинается с `/`, поэтому обычный текст не совпадёт с ней.
      if (!text.startsWith('/')) return next();

      // Аргументы пока не отделяются: `/name value` передаётся триггеру как `name value`.
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

  /** Выполняет middleware, когда текст сообщения совпал с триггером. */
  hears(
    triggers: Triggers<FilteredContext<Ctx, 'message_created'>>,
    ...middlewares: MiddlewareList<FilteredContext<Ctx, 'message_created'>>
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

  /** Выполняет middleware для callback payload нажатой кнопки. */
  action(
    triggers: Triggers<FilteredContext<Ctx, 'message_callback'>>,
    ...middlewares: MiddlewareList<FilteredContext<Ctx, 'message_callback'>>
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

  /** Проверяет update через тип события или guard и сужает тип Context. */
  filter<Filter extends UpdateFilter<Ctx>>(
    filters: MaybeArray<Filter>,
    ...middlewares: MiddlewareList<FilteredContext<Ctx, Filter>>
  ): MiddlewareFn<Ctx> {
    const handler = Composer.compose(middlewares);
    return (ctx, next) => {
      return ctx.has(filters) ? handler(ctx, next) : next();
    };
  }

  /**
   * Прекращает обработку update, когда условие выполнено.
   * При false управление передаётся следующему middleware.
   */
  drop(predicate: Predicate<Ctx>) {
    return this.use(Composer.drop(predicate));
  }

  /**
   * Параллельно запускает отдельный middleware и оставшуюся цепочку.
   * Метод ждёт обе ветки, поэтому их ошибки не превращаются в фоновые.
   */
  fork(middleware: Middleware<Ctx>) {
    return this.use(Composer.fork(middleware));
  }

  /**
   * Выполняет middleware как побочное действие, а затем продолжает цепочку.
   * Подходит, например, для логирования или сбора метрик перед обработчиком.
   */
  tap(middleware: Middleware<Ctx>) {
    return this.use(Composer.tap(middleware));
  }

  /**
   * Выбирает middleware отдельно для каждого update.
   * Выбор может зависеть от текущей session, прав пользователя или других данных Context.
   */
  lazy(factory: (ctx: Ctx) => MaybePromise<Middleware<Ctx>>) {
    return this.use(Composer.lazy(factory));
  }

  /**
   * Выполняет только одну из двух веток по результату условия.
   * Выбранная ветка сама решает, продолжать ли общую цепочку через `next()`.
   */
  branch(
    predicate: boolean | Predicate<Ctx>,
    onTrue: Middleware<Ctx>,
    onFalse: Middleware<Ctx>,
  ) {
    return this.use(Composer.branch(predicate, onTrue, onFalse));
  }

  /**
   * Выполняет middleware при true.
   * Если условие вернуло false, сразу переходит к следующему обработчику.
   */
  optional(predicate: Predicate<Ctx>, ...middlewares: MiddlewareList<Ctx>) {
    return this.use(Composer.optional(predicate, ...middlewares));
  }

  /**
   * Выбирает обработчик по вычисленному имени маршрута.
   * Маршрут может дополнить `ctx.state`; неизвестный маршрут передаётся в fallback.
   */
  dispatch<Handlers extends Record<PropertyKey, Middleware<Ctx>>>(
    route: (
      ctx: Ctx,
    ) => MaybePromise<DispatchResult<keyof Handlers> | null | undefined>,
    handlers: Handlers,
    fallback: Middleware<Ctx> = Composer.passThrough<Ctx>(),
  ) {
    return this.use(Composer.dispatch(route, handlers, fallback));
  }

  /** Сокращение для команды `/help`. */
  help(...middlewares: MiddlewareList<FilteredContext<Ctx, 'message_created'>>) {
    return this.command('help', ...middlewares);
  }

  /** Сокращение для команды `/settings`. */
  settings(...middlewares: MiddlewareList<FilteredContext<Ctx, 'message_created'>>) {
    return this.command('settings', ...middlewares);
  }

  static flatten<C extends Context>(middleware: Middleware<C>): MiddlewareFn<C> {
    return ComposerMiddleware.flatten(middleware);
  }

  static unwrap<C extends Context>(middleware: Middleware<C>): MiddlewareFn<C> {
    return Composer.flatten(middleware);
  }

  static concat<C extends Context>(
    first: MiddlewareFn<C>,
    andThen: MiddlewareFn<C>,
  ): MiddlewareFn<C> {
    return ComposerMiddleware.concat(first, andThen);
  }

  static pass<C extends Context>(ctx: C, next: NextFn) {
    return ComposerMiddleware.pass(ctx, next);
  }

  static passThrough<C extends Context = Context>(): MiddlewareFn<C> {
    return ComposerMiddleware.passThrough();
  }

  static compose<C extends Context>(middlewares: MiddlewareList<C>): MiddlewareFn<C> {
    return ComposerMiddleware.compose(middlewares);
  }

  /** Создаёт middleware с параллельной побочной веткой и ожидает обе ветки. */
  static fork<C extends Context>(middleware: Middleware<C>): MiddlewareFn<C> {
    return ComposerMiddleware.fork(middleware);
  }

  /** Создаёт middleware, которое выполняет действие перед переходом к `next()`. */
  static tap<C extends Context>(middleware: Middleware<C>): MiddlewareFn<C> {
    return ComposerMiddleware.tap(middleware);
  }

  /** Выбирает middleware во время обработки каждого update. */
  static lazy<C extends Context>(
    factory: (ctx: C) => MaybePromise<Middleware<C>>,
  ): MiddlewareFn<C> {
    return ComposerMiddleware.lazy(factory);
  }

  static log(
    logger: (message: string) => void,
  ): MiddlewareFn<Context> {
    return (ctx, next) => {
      logger(JSON.stringify(ctx.update, null, 2));
      return next();
    };
  }

  /** Перехватывает ошибки при выполнении переданной цепочки middleware. */
  static catch<C extends Context>(
    errorHandler: (error: unknown, ctx: C) => MaybePromise<void>,
    ...middlewares: MiddlewareList<C>
  ): MiddlewareFn<C> {
    return ComposerMiddleware.catchMiddleware(errorHandler, ...middlewares);
  }

  /** Создаёт middleware, которое выполняет одну из двух веток по условию. */
  static branch<C extends Context>(
    predicate: boolean | Predicate<C>,
    onTrue: Middleware<C>,
    onFalse: Middleware<C>,
  ): MiddlewareFn<C> {
    return ComposerMiddleware.branch(predicate, onTrue, onFalse);
  }

  /** Создаёт условную ветку, которая при false сразу вызывает `next()`. */
  static optional<C extends Context>(
    predicate: Predicate<C>,
    ...middlewares: MiddlewareList<C>
  ): MiddlewareFn<C> {
    return ComposerMiddleware.optional(predicate, ...middlewares);
  }

  /** Создаёт фильтр, прекращающий обработку update при выполнении условия. */
  static drop<C extends Context>(predicate: Predicate<C>): MiddlewareFn<C> {
    return ComposerMiddleware.drop(predicate);
  }

  /** Создаёт маршрутизатор по именованным обработчикам с необязательным fallback. */
  static dispatch<
    C extends Context,
    Handlers extends Record<PropertyKey, Middleware<C>>,
  >(
    route: (
      ctx: C,
    ) => MaybePromise<DispatchResult<keyof Handlers> | null | undefined>,
    handlers: Handlers,
    fallback: Middleware<C> = Composer.passThrough<C>(),
  ): MiddlewareFn<C> {
    return ComposerMiddleware.dispatch(route, handlers, fallback);
  }

  static reply(...args: Parameters<Context['reply']>): MiddlewareFn<Context> {
    return (ctx) => ctx.reply(...args);
  }
}
