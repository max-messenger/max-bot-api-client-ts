// Stable public facade. Internal folders may move without changing consumer imports.
export { Api } from './api';
export { Bot } from './bot';

// Update-scoped framework primitives.
export {
  Composer, Context,
  allOf, anyOf, createdMessageBodyHas, messageCallback, messageEdited,
} from './framework';
export type {
  AsyncPredicate, DispatchResult, FilteredContext, Middleware, MiddlewareFn,
  MiddlewareObj, NextFn, Predicate,
  TriggerFn, Triggers,
} from './framework';

// Persistent per-user/per-chat state.
export { MemorySessionStore, session } from './session';
export type {
  AsyncSessionStore, SessionContext, SessionOptions,
  SessionStore, SyncSessionStore,
} from './session';

// Named-step dialog flows stored inside session.
export { ConversationEngine, defineConversation, transition } from './conversation';
export type {
  ConversationContext,
  ConversationController,
  ConversationDefinition,
  ConversationEngineOptions,
  ConversationSession,
  ConversationState,
  ConversationStep,
  ConversationStepInput,
  ConversationTransition,
} from './conversation';

// Message payload and presentation helpers.
export {
  AudioAttachment, FileAttachment, ImageAttachment, Keyboard,
  LocationAttachment, ShareAttachment, StickerAttachment,
  VideoAttachment, fmt,
} from './helpers';
export { MaxError } from './core/network/api';
