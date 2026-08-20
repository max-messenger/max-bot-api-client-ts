import createDebug from 'debug';
import { setTimeout } from 'node:timers/promises';
import { Composer } from './composer';
import { Context } from './context';
import { MaybePromise } from './core/helpers/types';

import {
  BotInfo, ClientOptions, createClient, Update, UpdateType,
} from './core/network/api';
import { Polling } from './core/network/polling';

import { Api } from './api';

const debug = createDebug('max:main');
const POLLING_RESTART_ON_ERROR_TIMEOUT = 5000;

type BotConfig<Ctx extends Context> = {
  clientOptions?: ClientOptions;
  contextType: new (...args: ConstructorParameters<typeof Context>) => Ctx;
};

type LaunchOptions = Partial<{
  allowedUpdates: UpdateType[],
  retry: boolean
}>;

const defaultConfig: BotConfig<Context> = {
  contextType: Context,
};

export class Bot<Ctx extends Context = Context> extends Composer<Ctx> {
  api: Api;

  private abortController: AbortController | undefined;

  public botInfo?: BotInfo;

  private polling?: Polling;

  private pollingIsStarted = false;

  private config: BotConfig<Ctx>;

  constructor(token: string, config?: Partial<BotConfig<Ctx>>) {
    super();

    // @ts-ignore
    this.config = { ...defaultConfig, ...config };
    this.api = new Api(createClient(token, this.config.clientOptions));

    debug('Created `Bot` instance');
  }

  private handleError = (err: unknown, ctx: Ctx): MaybePromise<void> => {
    process.exitCode = 1;
    console.error('Unhandled error while processing', ctx.update);
    throw err;
  };

  catch(handler: (err: unknown, ctx: Ctx) => MaybePromise<void>) {
    this.handleError = handler;
    return this;
  }

  start = async (options?: LaunchOptions) => {
    if (this.pollingIsStarted) {
      debug('Long polling already running');
      return;
    }

    this.abortController = new AbortController();

    this.pollingIsStarted = true;
    let needsRetry = false;

    try {
      this.botInfo ??= await this.api.getMyInfo();
      this.polling = new Polling(this.api, this.abortController, options?.allowedUpdates);

      debug(`Starting @${this.botInfo.username}`);
      await this.polling.loop(this.handleUpdate);
    } catch (error) {
      console.error('Unhandled error while polling \n\r', error);
      needsRetry = options?.retry ?? true;
    } finally {
      this.pollingIsStarted = false;
      debug('Long polling stopped');
    }

    if (needsRetry) {
      debug('Retrying to restart long polling in %dms', POLLING_RESTART_ON_ERROR_TIMEOUT);
      await setTimeout(POLLING_RESTART_ON_ERROR_TIMEOUT, undefined, {
        signal: this.abortController.signal,
      });
      void this.start(options);
    }
  };

  stop = () => {
    if (!this.pollingIsStarted) {
      debug('Long polling is not running');
      return;
    }

    this.polling?.stop();
    this.pollingIsStarted = false;
  };

  private handleUpdate = async (update: Update) => {
    const updateId = `${update.update_type}:${update.timestamp}`;
    debug(`Processing update ${updateId}`);

    const UpdateContext = this.config.contextType;
    const ctx = new UpdateContext(update, this.api, this.botInfo);

    try {
      await this.middleware()(ctx, () => Promise.resolve(undefined));
    } catch (err) {
      await this.handleError(err, ctx);
    } finally {
      debug(`Finished processing update ${updateId}`);
    }
  };
}
