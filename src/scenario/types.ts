import type { MaybePromise } from '../core/types';
import type { Context } from '../core/context';

/** Сериализуемый прогресс сценария, который хранится в session. */
export interface ScenarioState<
  Data extends object = Record<string, unknown>,
  Step extends string = string,
> {
  id: string;
  step: Step;
  data: Data;
  expiresAt?: number;
}

export type ScenarioTransition<Data extends object, Step extends string> =
  | { type: 'stay'; data?: Partial<Data> }
  | { type: 'goto'; step: Step; data?: Partial<Data> }
  | { type: 'complete' }
  | { type: 'cancel' };

export interface ScenarioStepInput<
  C extends Context,
  Data extends object,
  Step extends string,
> {
  ctx: C;
  state: Readonly<ScenarioState<Data, Step>>;
  data: Readonly<Data>;
}

export type ScenarioStep<
  C extends Context,
  Data extends object,
  Step extends string,
> = (
  input: ScenarioStepInput<C, Data, Step>,
) => MaybePromise<ScenarioTransition<Data, Step>>;

export interface ScenarioDefinition<
  C extends Context,
  Data extends object,
  Step extends string,
> {
  id: string;
  initialStep: Step;
  idleTimeoutMs?: number;
  createData?: (ctx: C) => MaybePromise<Data>;
  /** Обрабатывает update, общие для всех шагов, например отмену. */
  intercept?: (
    input: ScenarioStepInput<C, Data, Step>,
  ) => MaybePromise<ScenarioTransition<Data, Step> | undefined>;
  steps: Record<Step, ScenarioStep<C, Data, Step>>;
}

export interface ScenarioSession {
  scenario?: ScenarioState<object, string>;
}

export interface ScenarioController<C extends Context> {
  readonly active: boolean;
  /** Идентификатор активного сценария. */
  readonly current?: string;
  start<Data extends object, Step extends string>(
    definition: ScenarioDefinition<C, Data, Step>,
    data?: Data,
  ): Promise<void>;
  /** Удаляет активный сценарий и сообщает, был ли он запущен. */
  cancel(): boolean;
}

export interface ScenarioContext extends Context {
  session?: ScenarioSession;
  scenario: ScenarioController<ScenarioContext>;
}

export interface ScenarioEngineOptions {
  /** Подменяемые часы для тестов и специальных окружений. */
  now?: () => number;
}
