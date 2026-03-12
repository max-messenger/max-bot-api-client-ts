import type { SceneContextScene, SceneSession, SceneSessionData } from '../context';
import type { Context } from '../../context';
import type { Middleware } from '../../middleware';
import type { SessionContext } from '../../session';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WizardSessionData extends SceneSessionData {
  cursor: number;
}

export interface WizardSession<S extends WizardSessionData = WizardSessionData>
  extends SceneSession<S> {}

export interface WizardContext<D extends WizardSessionData = WizardSessionData>
  extends Context {
  session: WizardSession<D>;
  scene: SceneContextScene<WizardContext<D>, D>;
  wizard: WizardContextWizard<WizardContext<D>>;
}

// ─── Wizard step cursor ────────────────────────────────────────────────────────

export class WizardContextWizard<
  C extends SessionContext<WizardSession> & {
    scene: SceneContextScene<C, WizardSessionData>;
  },
> {
  /** Shared state object (same reference as `ctx.scene.state`). */
  readonly state: Record<string, unknown>;

  constructor(
    private readonly ctx: C,
    private readonly steps: ReadonlyArray<Middleware<C>>,
  ) {
    this.state = ctx.scene.state;
    this.cursor = ctx.scene.session.cursor ?? 0;
  }

  /** The middleware for the current step, or `undefined` if the wizard is done. */
  get step(): Middleware<C> | undefined {
    return this.steps[this.cursor];
  }

  get cursor(): number {
    return this.ctx.scene.session.cursor;
  }

  set cursor(cursor: number) {
    this.ctx.scene.session.cursor = cursor;
  }

  /** Jump to a specific step by index. */
  selectStep(index: number) {
    this.cursor = index;
    return this;
  }

  /** Advance to the next step. */
  next() {
    return this.selectStep(this.cursor + 1);
  }

  /** Go back to the previous step. */
  back() {
    return this.selectStep(this.cursor - 1);
  }
}
