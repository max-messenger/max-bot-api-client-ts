import { BaseScene, type SceneOptions } from '../base';
import { Composer } from '../../composer';
import type { Context } from '../../context';
import type { Middleware, MiddlewareObj } from '../../middleware';
import type { SceneContextScene } from '../context';
import { WizardContextWizard, type WizardSessionData } from './context';

/**
 * A multi-step scene where each update is handled by the current "step".
 *
 * @example
 * const wizard = new WizardScene<MyCtx>(
 *   'form',
 *   (ctx) => { await ctx.reply('Step 1: Enter your name'); ctx.wizard.next() },
 *   (ctx) => { await ctx.reply(`Hello ${ctx.message?.body?.text}`); ctx.scene.leave() },
 * )
 */
export class WizardScene<
  C extends Context & {
    scene: SceneContextScene<C, WizardSessionData>;
    wizard: WizardContextWizard<C>;
  },
>
  extends BaseScene<C>
  implements MiddlewareObj<C>
{
  steps: Array<Middleware<C>>;

  constructor(id: string, ...steps: Array<Middleware<C>>);
  constructor(id: string, options: SceneOptions<C>, ...steps: Array<Middleware<C>>);
  constructor(
    id: string,
    optionsOrFirstStep: SceneOptions<C> | Middleware<C>,
    ...rest: Array<Middleware<C>>
  ) {
    let opts: SceneOptions<C> | undefined;
    let steps: Array<Middleware<C>>;

    if (typeof optionsOrFirstStep === 'function' || 'middleware' in optionsOrFirstStep) {
      opts = undefined;
      steps = [optionsOrFirstStep as Middleware<C>, ...rest];
    } else {
      opts = optionsOrFirstStep as SceneOptions<C>;
      steps = rest;
    }

    super(id, opts);
    this.steps = steps;
  }

  middleware() {
    return Composer.compose<C>([
      (ctx, next) => {
        ctx.wizard = new WizardContextWizard<C>(ctx, this.steps);
        return next();
      },
      super.middleware(),
      (ctx, next) => {
        if (ctx.wizard.step === undefined) {
          ctx.wizard.selectStep(0);
          return ctx.scene.leave();
        }
        return Composer.flatten(ctx.wizard.step)(ctx, next);
      },
    ]);
  }

  enterMiddleware() {
    return Composer.compose([this.enterHandler, this.middleware()]);
  }
}
