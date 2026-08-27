import type { Context } from '../core/context';
import type { MiddlewareFn } from '../core/middleware';
import type {
  ScenarioController,
  ScenarioDefinition,
  ScenarioEngineOptions,
  ScenarioSession,
  ScenarioState,
  ScenarioStepInput,
  ScenarioTransition,
} from './types';

// В одном реестре находятся сценарии с разными данными и шагами.
// Приведение к общим типам используется только внутри ScenarioEngine.
type StoredDefinition<C extends Context> = ScenarioDefinition<C, object, string>;

const hasStep = <C extends Context>(definition: StoredDefinition<C>, step: string) => {
  return Object.prototype.hasOwnProperty.call(definition.steps, step);
};

export const defineScenario = <C extends Context, Data extends object>() => {
  // Раздельные вызовы позволяют задать Context и Data, сохранив точный список имён шагов.
  return <Step extends string>(definition: ScenarioDefinition<C, Data, Step>) => definition;
};

/** Явные переходы делают изменение шага заметным в коде сценария. */
export const transition = {
  stay<Data extends object>(
    data?: Partial<Data>,
  ): Extract<ScenarioTransition<Data, string>, { type: 'stay' }> {
    // При exactOptionalPropertyTypes необязательное поле нельзя заполнять значением undefined.
    return data === undefined ? { type: 'stay' } : { type: 'stay', data };
  },
  goto<Step extends string, Data extends object = Record<string, never>>(
    step: Step,
    data?: Partial<Data>,
  ): Extract<ScenarioTransition<Data, Step>, { type: 'goto' }> {
    return data === undefined ? { type: 'goto', step } : { type: 'goto', step, data };
  },
  complete() {
    return { type: 'complete' as const };
  },
  cancel() {
    return { type: 'cancel' as const };
  },
};

/** Выполняет сценарии с именованными шагами и хранит прогресс в session. */
export class ScenarioEngine<
  C extends Context & {
    session?: ScenarioSession;
    scenario: ScenarioController<C>;
  },
> {
  private readonly definitions = new Map<string, StoredDefinition<C>>();

  private readonly now: () => number;

  constructor(options: ScenarioEngineOptions = {}) {
    this.now = options.now ?? Date.now;
  }

  register<Data extends object, Step extends string>(
    definition: ScenarioDefinition<C, Data, Step>,
  ) {
    this.validate(definition);
    if (this.definitions.has(definition.id)) {
      // Повторный id мог бы связать сохранённое состояние с другим сценарием.
      throw new TypeError(`Scenario "${definition.id}" is already registered`);
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

  /** Добавляет `ctx.scenario`, не передавая событие активному сценарию. */
  controllerMiddleware(): MiddlewareFn<C> {
    return async (ctx, next) => {
      ctx.scenario = this.controller(ctx);
      return next();
    };
  }

  /** Передаёт событие активному сценарию, а при его отсутствии продолжает цепочку. */
  interceptMiddleware(): MiddlewareFn<C> {
    return async (ctx, next) => {
      const state = ctx.session?.scenario;
      if (state === undefined) return next();

      if (state.expiresAt !== undefined && state.expiresAt <= this.now()) {
        // Просроченный сценарий удаляем, а текущее событие передаём следующим обработчикам.
        delete ctx.session?.scenario;
        return next();
      }

      await this.execute(ctx);
      return undefined;
    };
  }

  /** Создаёт обработчик для запуска переданного сценария. */
  start<Data extends object, Step extends string>(
    definition: ScenarioDefinition<C, Data, Step>,
    createData?: (ctx: C) => Data | Promise<Data>,
  ): MiddlewareFn<C> {
    return async (ctx) => {
      const data = createData === undefined ? undefined : await createData(ctx);
      await ctx.scenario.start(definition, data);
    };
  }

  private controller(ctx: C): ScenarioController<C> {
    return {
      get active() {
        return ctx.session?.scenario !== undefined;
      },
      get current() {
        return ctx.session?.scenario?.id;
      },
      start: async <Data extends object, Step extends string>(
        definition: ScenarioDefinition<C, Data, Step>,
        data?: Data,
      ) => {
        const session = this.requireSession(ctx);
        const candidate = definition as unknown as StoredDefinition<C>;
        const registered = this.definitions.get(definition.id);
        if (registered === undefined) {
          this.register(definition);
        } else if (registered !== candidate) {
          throw new TypeError(`Scenario "${definition.id}" uses another definition`);
        }
        if (session.scenario !== undefined) {
          throw new Error(`Scenario "${session.scenario.id}" is already active`);
        }

        const initialData = data ?? await definition.createData?.(ctx);
        if (initialData === undefined) {
          throw new TypeError(`Scenario "${definition.id}" requires initial data`);
        }
        // Сохраняем начальное состояние до выполнения, чтобы первый шаг можно было повторить.
        session.scenario = {
          id: definition.id,
          step: definition.initialStep,
          data: initialData,
          expiresAt: this.deadline(candidate),
        };
        await this.execute(ctx);
      },
      cancel: () => {
        const state = ctx.session?.scenario;
        if (state === undefined) return false;
        delete ctx.session?.scenario;
        return true;
      },
    };
  }

  private async execute(ctx: C) {
    const session = this.requireSession(ctx);
    const state = session.scenario;
    if (state === undefined) return;

    const definition = this.definitions.get(state.id);
    if (definition === undefined) {
      throw new Error(`Scenario "${state.id}" is not registered`);
    }
    if (!hasStep(definition, state.step)) {
      throw new Error(`Scenario "${state.id}" has no step "${state.step}"`);
    }
    const step = definition.steps[state.step];

    // Шаг получает копию состояния и меняет сохранённые данные только через результат перехода.
    const snapshot = structuredClone(state);
    const input: ScenarioStepInput<C, object, string> = {
      ctx,
      state: Object.freeze(snapshot),
      data: Object.freeze(snapshot.data),
    };
    // Если `intercept` не обработал событие, его получает текущий шаг.
    const result = await definition.intercept?.(input) ?? await step(input);
    this.apply(session, definition, state, result);
  }

  private apply(
    session: ScenarioSession,
    definition: StoredDefinition<C>,
    state: ScenarioState<object, string>,
    result: ScenarioTransition<object, string>,
  ) {
    const target = session;
    if (result === undefined || result === null || typeof result !== 'object') {
      throw new TypeError('Scenario step must return a transition');
    }
    if (!['stay', 'goto', 'complete', 'cancel'].includes(result.type)) {
      throw new TypeError(`Unsupported scenario transition "${String(result.type)}"`);
    }
    if (result.type === 'complete' || result.type === 'cancel') {
      delete target.scenario;
      return;
    }

    const nextStep = result.type === 'goto' ? result.step : state.step;
    if (!hasStep(definition, nextStep)) {
      throw new TypeError(`Scenario "${state.id}" has no step "${nextStep}"`);
    }
    target.scenario = {
      id: state.id,
      step: nextStep,
      data: { ...state.data, ...(result.data ?? {}) },
      // Успешный `stay` или `goto` заново запускает отсчёт времени неактивности.
      expiresAt: this.deadline(definition),
    };
  }

  private requireSession(ctx: C): ScenarioSession {
    if (ctx.session === undefined) {
      throw new Error('ScenarioEngine requires session()');
    }
    return ctx.session;
  }

  private deadline(definition: StoredDefinition<C>) {
    return definition.idleTimeoutMs === undefined
      ? undefined
      : this.now() + definition.idleTimeoutMs;
  }

  private validate<Data extends object, Step extends string>(
    definition: ScenarioDefinition<C, Data, Step>,
  ) {
    if (!definition.id) throw new TypeError('Scenario id must not be empty');
    if (!hasStep(definition as unknown as StoredDefinition<C>, definition.initialStep)) {
      throw new TypeError(
        `Scenario "${definition.id}" has no initial step "${definition.initialStep}"`,
      );
    }
    if (definition.idleTimeoutMs !== undefined
      && (!Number.isFinite(definition.idleTimeoutMs) || definition.idleTimeoutMs <= 0)) {
      throw new RangeError('Scenario idleTimeoutMs must be a positive number');
    }
  }
}
