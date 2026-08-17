import type { MaybePromise } from '../core/types';
import type { Context } from '../framework/context';

/** Serializable progress stored inside the bot session. */
export interface ConversationState<
  Data extends object = Record<string, unknown>,
  Step extends string = string,
> {
  id: string;
  step: Step;
  data: Data;
  expiresAt?: number;
}

export type ConversationTransition<Data extends object, Step extends string> =
  | { type: 'stay'; data?: Partial<Data> }
  | { type: 'goto'; step: Step; data?: Partial<Data> }
  | { type: 'complete' }
  | { type: 'cancel' };

export interface ConversationStepInput<
  C extends Context,
  Data extends object,
  Step extends string,
> {
  ctx: C;
  state: Readonly<ConversationState<Data, Step>>;
  data: Readonly<Data>;
}

export type ConversationStep<
  C extends Context,
  Data extends object,
  Step extends string,
> = (
  input: ConversationStepInput<C, Data, Step>,
) => MaybePromise<ConversationTransition<Data, Step>>;

export interface ConversationDefinition<
  C extends Context,
  Data extends object,
  Step extends string,
> {
  id: string;
  initialStep: Step;
  idleTimeoutMs?: number;
  createData?: (ctx: C) => MaybePromise<Data>;
  /** Handles commands that apply to every step, for example cancellation. */
  intercept?: (
    input: ConversationStepInput<C, Data, Step>,
  ) => MaybePromise<ConversationTransition<Data, Step> | undefined>;
  steps: Record<Step, ConversationStep<C, Data, Step>>;
}

export interface ConversationSession {
  conversation?: ConversationState<object, string>;
}

export interface ConversationController<C extends Context> {
  readonly active: boolean;
  /** Identifier of the active conversation, if any. */
  readonly current?: string;
  start<Data extends object, Step extends string>(
    definition: ConversationDefinition<C, Data, Step>,
    data?: Data,
  ): Promise<void>;
  /** Removes the active conversation and reports whether one existed. */
  cancel(): boolean;
}

export interface ConversationContext extends Context {
  session?: ConversationSession;
  conversation: ConversationController<ConversationContext>;
}

export interface ConversationEngineOptions {
  /** Injectable clock for tests and specialized runtimes. */
  now?: () => number;
}
