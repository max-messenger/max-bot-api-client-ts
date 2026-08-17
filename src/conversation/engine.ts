import type { Context } from '../framework/context';
import type { MiddlewareFn } from '../framework/middleware';
import type {
  ConversationController,
  ConversationDefinition,
  ConversationEngineOptions,
  ConversationSession,
  ConversationState,
  ConversationStepInput,
  ConversationTransition,
} from './types';

// The registry contains definitions with different data and step types. Their
// exact generics remain visible to application code and are erased only here.
type StoredDefinition<C extends Context> = ConversationDefinition<C, object, string>;

const hasStep = <C extends Context>(definition: StoredDefinition<C>, step: string) => {
  return Object.prototype.hasOwnProperty.call(definition.steps, step);
};

export const defineConversation = <C extends Context, Data extends object>() => {
  // Two calls let users provide Context/Data while keeping the exact step-name
  // union explicit; TypeScript cannot partially specify generic parameters.
  return <Step extends string>(definition: ConversationDefinition<C, Data, Step>) => definition;
};

/** Explicit transitions keep step changes visible in application code. */
export const transition = {
  stay<Data extends object>(
    data?: Partial<Data>,
  ): Extract<ConversationTransition<Data, string>, { type: 'stay' }> {
    // Omit the optional field instead of returning `data: undefined`, which is
    // required by projects using exactOptionalPropertyTypes.
    return data === undefined ? { type: 'stay' } : { type: 'stay', data };
  },
  goto<Step extends string, Data extends object = Record<string, never>>(
    step: Step,
    data?: Partial<Data>,
  ): Extract<ConversationTransition<Data, Step>, { type: 'goto' }> {
    return data === undefined ? { type: 'goto', step } : { type: 'goto', step, data };
  },
  complete() {
    return { type: 'complete' as const };
  },
  cancel() {
    return { type: 'cancel' as const };
  },
};

/** Routes session-backed conversations by stable, named steps. */
export class ConversationEngine<
  C extends Context & {
    session?: ConversationSession;
    conversation: ConversationController<C>;
  },
> {
  private readonly definitions = new Map<string, StoredDefinition<C>>();

  private readonly now: () => number;

  constructor(options: ConversationEngineOptions = {}) {
    this.now = options.now ?? Date.now;
  }

  register<Data extends object, Step extends string>(
    definition: ConversationDefinition<C, Data, Step>,
  ) {
    this.validate(definition);
    if (this.definitions.has(definition.id)) {
      // One id must always resolve to one definition. Replacing it could make a
      // step already stored in a user's session impossible to execute.
      throw new TypeError(`Conversation "${definition.id}" is already registered`);
    }
    this.definitions.set(definition.id, definition as unknown as StoredDefinition<C>);
    return this;
  }

  middleware(): MiddlewareFn<C> {
    const controller = this.controllerMiddleware();
    const intercept = this.interceptMiddleware();
    return (ctx, next) => controller(ctx, async () => {
      await intercept(ctx, next);
    });
  }

  /**
   * Adds the conversation controller without consuming an active conversation.
   * Global commands may be registered after this middleware and before
   * interceptMiddleware().
   */
  controllerMiddleware(): MiddlewareFn<C> {
    return async (ctx, next) => {
      ctx.conversation = this.controller(ctx);
      return next();
    };
  }

  /** Routes an active conversation; inactive and expired states continue. */
  interceptMiddleware(): MiddlewareFn<C> {
    return async (ctx, next) => {
      const state = ctx.session?.conversation;
      if (state === undefined) return next();

      if (state.expiresAt !== undefined && state.expiresAt <= this.now()) {
        // The expired update is passed downstream as a normal update instead
        // of being consumed by a conversation that no longer exists.
        delete ctx.session?.conversation;
        return next();
      }

      await this.execute(ctx);
      return undefined;
    };
  }

  /** Creates command middleware that starts the supplied definition. */
  start<Data extends object, Step extends string>(
    definition: ConversationDefinition<C, Data, Step>,
    createData?: (ctx: C) => Data | Promise<Data>,
  ): MiddlewareFn<C> {
    return async (ctx) => {
      const data = createData === undefined ? undefined : await createData(ctx);
      await ctx.conversation.start(definition, data);
    };
  }

  private controller(ctx: C): ConversationController<C> {
    return {
      get active() {
        return ctx.session?.conversation !== undefined;
      },
      get current() {
        return ctx.session?.conversation?.id;
      },
      start: async <Data extends object, Step extends string>(
        definition: ConversationDefinition<C, Data, Step>,
        data?: Data,
      ) => {
        const session = this.requireSession(ctx);
        const candidate = definition as unknown as StoredDefinition<C>;
        const registered = this.definitions.get(definition.id);
        if (registered === undefined) {
          this.register(definition);
        } else if (registered !== candidate) {
          throw new TypeError(`Conversation "${definition.id}" uses another definition`);
        }
        if (session.conversation !== undefined) {
          throw new Error(`Conversation "${session.conversation.id}" is already active`);
        }

        const initialData = data ?? await definition.createData?.(ctx);
        if (initialData === undefined) {
          throw new TypeError(`Conversation "${definition.id}" requires initial data`);
        }
        // Persist the initial position before running it. If the first step
        // fails, the same step remains available on the next update.
        session.conversation = {
          id: definition.id,
          step: definition.initialStep,
          data: initialData,
          expiresAt: this.deadline(candidate),
        };
        await this.execute(ctx);
      },
      cancel: () => {
        const state = ctx.session?.conversation;
        if (state === undefined) return false;
        delete ctx.session?.conversation;
        return true;
      },
    };
  }

  private async execute(ctx: C) {
    const session = this.requireSession(ctx);
    const state = session.conversation;
    if (state === undefined) return;

    const definition = this.definitions.get(state.id);
    if (definition === undefined) {
      throw new Error(`Conversation "${state.id}" is not registered`);
    }
    if (!hasStep(definition, state.step)) {
      throw new Error(`Conversation "${state.id}" has no step "${state.step}"`);
    }
    const step = definition.steps[state.step];

    // Clone the stored value before handing it to application code. Only the
    // transition patch below may change persisted conversation data, and a
    // failed step leaves the previous value available for retry.
    const snapshot = structuredClone(state);
    const input: ConversationStepInput<C, object, string> = {
      ctx,
      state: Object.freeze(snapshot),
      data: Object.freeze(snapshot.data),
    };
    // A conversation-wide interceptor may handle the update itself. Returning
    // undefined delegates the same update to the current step.
    const result = await definition.intercept?.(input) ?? await step(input);
    this.apply(session, definition, state, result);
  }

  private apply(
    session: ConversationSession,
    definition: StoredDefinition<C>,
    state: ConversationState<object, string>,
    result: ConversationTransition<object, string>,
  ) {
    const target = session;
    if (result === undefined || result === null || typeof result !== 'object') {
      throw new TypeError('Conversation step must return a transition');
    }
    if (!['stay', 'goto', 'complete', 'cancel'].includes(result.type)) {
      throw new TypeError(`Unsupported conversation transition "${String(result.type)}"`);
    }
    if (result.type === 'complete' || result.type === 'cancel') {
      delete target.conversation;
      return;
    }

    const nextStep = result.type === 'goto' ? result.step : state.step;
    if (!hasStep(definition, nextStep)) {
      throw new TypeError(`Conversation "${state.id}" has no step "${nextStep}"`);
    }
    target.conversation = {
      id: state.id,
      step: nextStep,
      data: { ...state.data, ...(result.data ?? {}) },
      // Successful activity extends the idle deadline. Failed steps do not
      // apply a transition and therefore keep the previously stored deadline.
      expiresAt: this.deadline(definition),
    };
  }

  private requireSession(ctx: C): ConversationSession {
    if (ctx.session === undefined) {
      throw new Error('ConversationEngine requires session() with defaultSession');
    }
    return ctx.session;
  }

  private deadline(definition: StoredDefinition<C>) {
    return definition.idleTimeoutMs === undefined
      ? undefined
      : this.now() + definition.idleTimeoutMs;
  }

  private validate<Data extends object, Step extends string>(
    definition: ConversationDefinition<C, Data, Step>,
  ) {
    if (!definition.id) throw new TypeError('Conversation id must not be empty');
    if (!hasStep(definition as unknown as StoredDefinition<C>, definition.initialStep)) {
      throw new TypeError(
        `Conversation "${definition.id}" has no initial step "${definition.initialStep}"`,
      );
    }
    if (definition.idleTimeoutMs !== undefined
      && (!Number.isFinite(definition.idleTimeoutMs) || definition.idleTimeoutMs <= 0)) {
      throw new RangeError('Conversation idleTimeoutMs must be a positive number');
    }
  }
}
