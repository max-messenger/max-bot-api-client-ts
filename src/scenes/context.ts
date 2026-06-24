import createDebug from 'debug';
import { Composer } from '../composer';
import type { BaseScene } from './base';
import type { Context } from '../context';
import type { SessionContext } from '../session';

const debug = createDebug('max:scenes:context');

const noop = () => Promise.resolve();
const nowSec = () => Math.floor(Date.now() / 1000);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SceneSessionData {
  /** ID of the currently active scene. */
  current?: string;
  /** Unix timestamp (seconds) after which the session expires. */
  expires?: number;
  /** Arbitrary state passed between scene steps. */
  state?: Record<string, unknown>;
}

export interface SceneSession<S extends SceneSessionData = SceneSessionData> {
  __scenes?: S;
}

export interface SceneContextSceneOptions<D extends SceneSessionData> {
  ttl?: number;
  /** Scene ID used when no other scene is active. */
  default?: string;
  defaultSession: D;
}

export interface SceneContext<D extends SceneSessionData = SceneSessionData>
  extends Context {
  session: SceneSession<D>;
  scene: SceneContextScene<SceneContext<D>, D>;
}

// ─── Scene controller (lives on ctx.scene) ────────────────────────────────────

export class SceneContextScene<
  C extends SessionContext<SceneSession<D>>,
  D extends SceneSessionData = SceneSessionData,
> {
  private readonly options: SceneContextSceneOptions<D>;

  constructor(
    private readonly ctx: C,
    private readonly scenes: Map<string, BaseScene<C>>,
    options: Partial<SceneContextSceneOptions<D>>,
  ) {
    const fallback = {} as D;
    this.options = { defaultSession: fallback, ...options };
  }

  get session(): D {
    const defaultSession = { ...this.options.defaultSession };

    let session = this.ctx.session?.__scenes ?? defaultSession;
    if (session.expires !== undefined && session.expires < nowSec()) {
      session = defaultSession;
    }
    if (this.ctx.session === undefined) {
      this.ctx.session = { __scenes: session };
    } else {
      this.ctx.session.__scenes = session;
    }
    return session;
  }

  get state(): Record<string, unknown> {
    return (this.session.state ??= {});
  }

  set state(value: Record<string, unknown>) {
    this.session.state = { ...value };
  }

  /** The currently active scene, or `undefined` when none is active. */
  get current(): BaseScene<C> | undefined {
    const sceneId = this.session.current ?? this.options.default;
    if (sceneId === undefined || !this.scenes.has(sceneId)) return undefined;
    return this.scenes.get(sceneId);
  }

  /** Clears scene session data. */
  reset() {
    if (this.ctx.session !== undefined) {
      this.ctx.session.__scenes = { ...this.options.defaultSession };
    }
  }

  async enter(sceneId: string, initialState: Record<string, unknown> = {}, silent = false) {
    if (!this.scenes.has(sceneId)) {
      throw new Error(`Max: can't find scene "${sceneId}"`);
    }
    if (!silent) {
      await this.leave();
    }
    debug('Entering scene %s (silent=%s)', sceneId, silent);
    this.session.current = sceneId;
    this.state = initialState;

    const ttl = this.current?.ttl ?? this.options.ttl;
    if (ttl !== undefined) {
      this.session.expires = nowSec() + ttl;
    }

    if (this.current === undefined || silent) return;

    const scene = this.current;
    const handler =
      typeof scene.enterMiddleware === 'function'
        ? scene.enterMiddleware()
        : scene.middleware();

    return await handler(this.ctx, noop);
  }

  reenter() {
    return this.session.current === undefined
      ? undefined
      : this.enter(this.session.current, this.state);
  }

  private leaving = false;

  async leave() {
    if (this.leaving) return;
    debug('Leaving scene');
    try {
      this.leaving = true;
      if (this.current === undefined) return;

      const scene = this.current;
      const handler =
        typeof scene.leaveMiddleware === 'function'
          ? scene.leaveMiddleware()
          : Composer.passThru<C>();

      await handler(this.ctx, noop);
      this.reset();
    } finally {
      this.leaving = false;
    }
  }
}
