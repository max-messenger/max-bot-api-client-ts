import { Composer } from '../composer';
import { BaseScene } from './base';
import { SceneContextScene, type SceneSession, type SceneSessionData } from './context';
import type { SessionContext } from '../session';
import type { Context } from '../context';

/**
 * Scene manager middleware.
 *
 * @example
 * const greeter = new BaseScene<MyCtx>('greeter')
 * greeter.enter((ctx) => ctx.reply('Welcome!'))
 * greeter.on('message_created', (ctx) => ctx.scene.leave())
 *
 * const stage = new Stage<MyCtx>([greeter])
 * bot.use(session())
 * bot.use(stage)
 * bot.command('start', (ctx) => ctx.scene.enter('greeter'))
 */
export class Stage<
  C extends SessionContext<SceneSession<D>> & {
    scene: SceneContextScene<C, D>;
  },
  D extends SceneSessionData = SceneSessionData,
> extends Composer<C> {
  scenes: Map<string, BaseScene<C>>;

  constructor(
    scenes: ReadonlyArray<BaseScene<C>> = [],
    public readonly options: Partial<{ ttl: number; default: string }> = {},
  ) {
    super();
    this.scenes = new Map<string, BaseScene<C>>();
    scenes.forEach((scene) => this.register(scene));
  }

  /** Add a scene to the registry. */
  register(...scenes: ReadonlyArray<BaseScene<C>>) {
    scenes.forEach((scene) => {
      if (scene?.id == null || typeof scene.middleware !== 'function') {
        throw new Error('Stage: unsupported scene object');
      }
      this.scenes.set(scene.id, scene);
    });
    return this;
  }

  middleware() {
    const handler = Composer.compose<C>([
      (ctx, next) => {
        ctx.scene = new SceneContextScene<C, D>(ctx, this.scenes, this.options);
        return next();
      },
      super.middleware(),
      Composer.lazy<C>((ctx) => ctx.scene.current ?? Composer.passThru<C>()),
    ]);
    // Only activate when ctx.session exists.
    return Composer.optional<C>(
      (ctx): ctx is C => 'session' in ctx,
      handler,
    );
  }

  // ─── Static shortcuts ───────────────────────────────────────────────

  static enter<C extends Context & { scene: SceneContextScene<C> }>(
    ...args: Parameters<SceneContextScene<C>['enter']>
  ) {
    return (ctx: C) => ctx.scene.enter(...args);
  }

  static reenter<C extends Context & { scene: SceneContextScene<C> }>() {
    return (ctx: C) => ctx.scene.reenter();
  }

  static leave<C extends Context & { scene: SceneContextScene<C> }>() {
    return (ctx: C) => ctx.scene.leave();
  }
}
