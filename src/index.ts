// Стабильный публичный фасад: внутренние папки можно менять без изменения импортов SDK.
export { Api } from './api';
export { Bot } from './bot';

// Базовые инструменты обработки событий.
export { Composer } from './core/composer';
export { Context } from './core/context';
export {
  allOf, anyOf, createdMessageBodyHas, messageCallback, messageEdited,
} from './core/composer/modules/filters';
export type {
  AsyncPredicate, DispatchResult, Predicate, TriggerFn, Triggers,
} from './core/composer';
export type { FilteredContext } from './core/context';
export type {
  Middleware, MiddlewareFn, MiddlewareList, MiddlewareObj, NextFn,
} from './core/middleware';

// Состояние пользователя и чата между событиями.
export { MemorySessionStore, session } from './session';
export type {
  AsyncSessionStore, SessionContext, SessionOptions,
  SessionStore, SyncSessionStore,
} from './session';

// Сценарии с именованными шагами, состояние которых хранится в session.
export { ScenarioEngine, defineScenario, transition } from './scenario';
export type {
  ScenarioContext,
  ScenarioController,
  ScenarioDefinition,
  ScenarioEngineOptions,
  ScenarioSession,
  ScenarioState,
  ScenarioStep,
  ScenarioStepInput,
  ScenarioTransition,
} from './scenario';

// Вложения, кнопки и форматирование сообщений.
export {
  AudioAttachment, FileAttachment, ImageAttachment, Keyboard,
  LocationAttachment, ShareAttachment, StickerAttachment,
  VideoAttachment, fmt,
} from './helpers';
export { MaxError } from './core/network/api';
