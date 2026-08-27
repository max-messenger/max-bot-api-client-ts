import { Context, type FilteredContext } from '../context';
import type {
  Middleware, MiddlewareFn, MiddlewareList, MiddlewareObj, NextFn,
} from '../middleware';

import type { UpdateType } from '../network/api';
import type {
  Guard, MaybeArray, MaybePromise,
} from '../types';
import * as ComposerMiddleware from './modules';
import type { AsyncPredicate, DispatchResult, Predicate } from './modules';
import { createdMessageBodyHas } from './modules/filters';
import { extractTextFromMessage, normalizeTriggers } from './modules/triggers';
import type { TriggerFn, Triggers } from './modules/triggers';

export type {
  AsyncPredicate, DispatchResult, Predicate, TriggerFn, Triggers,
};

type UpdateFilter<Ctx extends Context> = UpdateType | Guard<Ctx['update']>;

/** Собирает цепочку обработчиков. Каждый обработчик продолжает её вызовом `next()`. */
export class Composer<Ctx extends Context> implements MiddlewareObj<Ctx> {
  private handler: MiddlewareFn<Ctx>;

  constructor(...middlewares: MiddlewareList<Ctx>) {
    this.handler = Composer.compose(middlewares);
  }

  /** Возвращает собранный обработчик для подключения к другой цепочке. */
  middleware() {
    return this.handler;
  }

  /** Добавляет обработчики в конец текущей цепочки. */
  use(...middlewares: MiddlewareList<Ctx>) {
    this.handler = Composer.compose([this.handler, ...middlewares]);
    return this;
  }

  /** Выполняет обработчики для событий указанных типов или прошедших type guard. */
  on<Filter extends UpdateType | Guard<Ctx['update']>>(
    filters: MaybeArray<Filter>,
    ...middlewares: MiddlewareList<FilteredContext<Ctx, Filter>>
  ) {
    return this.use(this.filter(filters, ...middlewares));
  }

  /** Выполняет обработчики для команды в текстовом сообщении. */
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

      // В `/name value` триггер получает всю строку после слеша: `name value`.
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

  /** Выполняет обработчики, когда текст сообщения совпал с триггером. */
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

  /** Выполняет обработчики, когда `payload` нажатой кнопки совпал с триггером. */
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

  /** Проверяет событие по типу или type guard и уточняет тип Context. */
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
   * Прекращает обработку события, когда условие выполнено.
   * В противном случае вызывает следующий обработчик.
   */
  drop(predicate: Predicate<Ctx>) {
    return this.use(Composer.drop(predicate));
  }

  /**
   * Одновременно запускает переданный обработчик и оставшуюся цепочку.
   * Если одна из веток завершится с ошибкой, `fork` также завершится с ошибкой.
   */
  fork(middleware: Middleware<Ctx>) {
    return this.use(Composer.fork(middleware));
  }

  /**
   * Выполняет обработчик как дополнительное действие, а затем продолжает цепочку.
   * Подходит, например, для логирования или сбора метрик перед обработчиком.
   */
  tap(middleware: Middleware<Ctx>) {
    return this.use(Composer.tap(middleware));
  }

  /**
   * Выбирает обработчик отдельно для каждого события.
   * Выбор может зависеть от сессии, прав пользователя или других данных Context.
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
   * Выполняет переданные обработчики, когда условие возвращает true.
   * Иначе сразу продолжает основную цепочку.
   */
  optional(predicate: Predicate<Ctx>, ...middlewares: MiddlewareList<Ctx>) {
    return this.use(Composer.optional(predicate, ...middlewares));
  }

  /**
   * Выбирает обработчик по имени маршрута, вычисленному для текущего Context.
   * Маршрут может дополнить `ctx.state`; неизвестный маршрут обрабатывает `fallback`.
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

  /** Одновременно запускает переданный обработчик и оставшуюся цепочку. */
  static fork<C extends Context>(middleware: Middleware<C>): MiddlewareFn<C> {
    return ComposerMiddleware.fork(middleware);
  }

  /** Выполняет дополнительное действие перед переходом к `next()`. */
  static tap<C extends Context>(middleware: Middleware<C>): MiddlewareFn<C> {
    return ComposerMiddleware.tap(middleware);
  }

  /** Выбирает обработчик во время обработки каждого события. */
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

  /** Передаёт ошибки из указанной цепочки в `errorHandler`. */
  static catch<C extends Context>(
    errorHandler: (error: unknown, ctx: C) => MaybePromise<void>,
    ...middlewares: MiddlewareList<C>
  ): MiddlewareFn<C> {
    return ComposerMiddleware.catchMiddleware(errorHandler, ...middlewares);
  }

  /** Выполняет одну из двух веток в зависимости от условия. */
  static branch<C extends Context>(
    predicate: boolean | Predicate<C>,
    onTrue: Middleware<C>,
    onFalse: Middleware<C>,
  ): MiddlewareFn<C> {
    return ComposerMiddleware.branch(predicate, onTrue, onFalse);
  }

  /** Выполняет цепочку при true и сразу вызывает `next()` при false. */
  static optional<C extends Context>(
    predicate: Predicate<C>,
    ...middlewares: MiddlewareList<C>
  ): MiddlewareFn<C> {
    return ComposerMiddleware.optional(predicate, ...middlewares);
  }

  /** Прекращает обработку события при выполнении условия. */
  static drop<C extends Context>(predicate: Predicate<C>): MiddlewareFn<C> {
    return ComposerMiddleware.drop(predicate);
  }

  /** Выбирает именованный обработчик или использует `fallback`. */
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
