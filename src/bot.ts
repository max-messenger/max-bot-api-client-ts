import { setTimeout } from 'node:timers/promises';
import createDebug from 'debug';
import { Api } from './api';
import { Composer } from './composer';
import { Context } from './context';
import { MaybePromise } from './core/helpers/types';

import {
  BotInfo, ClientOptions, createClient, Update, UpdateType,
} from './core/network/api';
import { Polling } from './core/network/polling';
import { Webhook, type WebhookOptions } from './core/network/webhook';

const debug = createDebug('max:main');
const POLLING_RESTART_ON_ERROR_TIMEOUT = 5000;

type BotConfig<Ctx extends Context> = {
  clientOptions?: ClientOptions;
  contextType: new (...args: ConstructorParameters<typeof Context>) => Ctx;
};

type PollingLaunchOptions = Partial<{
  allowedUpdates: UpdateType[],
  retry: boolean
}>;

type WebhookLaunchOptions = WebhookOptions & {
  allowedUpdates?: UpdateType[];
}

type StartPollingConfig = {
  mode: 'polling';
  options?: PollingLaunchOptions;
};

type StartWebhookConfig = {
  mode: 'webhook';
  options: WebhookLaunchOptions;
};

type StartConfig = StartPollingConfig | StartWebhookConfig;

const defaultConfig: BotConfig<Context> = {
  contextType: Context,
};

export class Bot<Ctx extends Context = Context> extends Composer<Ctx> {
  api: Api;

  private readonly token: string;

  private abortController: AbortController | undefined;

  public botInfo?: BotInfo;

  private polling?: Polling;

  private webhook?: Webhook;

  private pollingIsStarted = false;

  private webhookIsStarted = false;

  private config: BotConfig<Ctx>;

  constructor(token: string, config?: Partial<BotConfig<Ctx>>) {
    super();

    // @ts-expect-error ожидаемое
    this.config = { ...defaultConfig, ...config };
    this.api = new Api(createClient(token, this.config.clientOptions));
    this.token = token;

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

  start = async (config: StartConfig = { mode: 'polling' }) => {
    try {
      this.botInfo ??= await this.api.getMyInfo();
    } catch (error) {
      console.error('Failed to fetch bot info on startup', error);
      throw error;
    }

    if (config.mode === 'polling') {
      return this.startPolling(config.options);
    }

    if (config.mode === 'webhook') {
      return this.startWebhook(config.options);
    }
  };

  startPolling = async (options?: PollingLaunchOptions) => {
    if (this.webhookIsStarted) {
      debug('Long polling aborted: webhook updates handling already running');
      return;
    }

    if (this.pollingIsStarted) {
      debug('Long polling already running');
      return;
    }

    this.abortController = new AbortController();
    this.pollingIsStarted = true;
    let needsRetry = false;

    try {
      this.polling = new Polling(this.api, this.abortController, options?.allowedUpdates);

      debug(`Starting @${this.botInfo!.username} via Long Polling`);
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
      try {
        await setTimeout(POLLING_RESTART_ON_ERROR_TIMEOUT, undefined, {
          signal: this.abortController.signal,
        });
        void this.startPolling(options);
      } catch {
        debug('Polling restart aborted via AbortSignal');
      }
    }
  };

  public webhookCallback(options: WebhookLaunchOptions) {
    const { allowedUpdates, ...rest } = options

    this.webhook ??= new Webhook(
      this.api,
      allowedUpdates,
      this.token,
      rest
    );

    return this.webhook.createCallback(this.handleUpdate);
  }

  startWebhook = async (options: WebhookLaunchOptions) => {
    if (this.webhookIsStarted) {
      debug('Webhook already running');
      return;
    }

    if (this.pollingIsStarted) {
      debug('Webhook start aborted: long polling already running');
      return;
    }
    debug(`Starting @${this.botInfo?.username} via Webhook`);

    const { allowedUpdates, ...rest } = options

    this.webhook ??= new Webhook(this.api, allowedUpdates, this.token, rest);

    try {
      await this.webhook.start(this.handleUpdate)
    } catch (error) {
      console.error('Unhandled error on webhook startup \n\r', error);
      throw error;
    }

    try {
      await Webhook.clearSubscriptions(this.api, this.webhook.url)
    } catch (error) {
      debug('Failed to unsubscribe from webhook updates: %O', error);
    }

    this.webhookIsStarted = true;
  };

  stopPolling = () => {
    if (!this.pollingIsStarted) {
      debug('Long polling is not running');
      return;
    }

    this.polling?.stop();
    this.pollingIsStarted = false;
  };

  stopWebhook = async () => {
    if (!this.webhookIsStarted) {
      debug('Webhook is not running');
      return;
    }

    await this.webhook?.stop()
    this.webhookIsStarted = false;
    debug('Webhook stopped');
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
