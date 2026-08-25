import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import createDebug from 'debug';

import type { Api } from '../../api';
import { Update, UpdateType } from './api';

const debug = createDebug('max:webhook');
const BOT_API_SECRET_HEADER = 'x-max-bot-api-secret';
const RESPONSE_DEFAULT_HEADERS = { 'Content-Type': 'text/plain' }

export type WebhookOptions = {
  // Внешний HTTPS домен вашего прокси (например, 'https://my-domain.com')
  domain: string;
  // Порт для локального сервера Node.js (по умолчанию 3000)
  port?: number;
  // Кастомный роут для получения обновлений.
  // Генерируется стабильный роут от токена бота, если не передать
  path?: string;
  // Секрет, который передается в MAX и проверяется в заголовке при получении ответов.
  // Параметр является опциональным, но настоятельно рекомендуем его передавать
  secret?: string;
}

export class Webhook {
  public readonly url: string;

  private server: Server | null = null;
  private readonly port: number;
  private readonly hookPath: string;
  private readonly secret?: string;

  constructor(
    private readonly api: Api,
    private readonly allowedUpdates: UpdateType[] = [],
    token: string,
    options: WebhookOptions
  ) {
    this.port = options.port || 3000;

    this.secret = options.secret;

    this.hookPath = options.path ?? `/webhook/${this.generateTokenRelatedHash(token)}`;

    this.url = this.getWebhookUrl(options.domain);
  }

  public static clearSubscriptions = async (api: Api, activeUrl?: string) => {
    const subscriptions = await api.getSubscriptions();

    return Promise.all(
      subscriptions.map((subscription) => {
        if (subscription.url === activeUrl) {
          return Promise.resolve();
        }
        return api.unsubscribe(subscription.url);
      }))
  }

  createCallback = (handleUpdate: (update: Update) => Promise<void>) => {
    return (req: IncomingMessage, res: ServerResponse) => {
      const botApiSecretHeader = req.headers[BOT_API_SECRET_HEADER];

      if (
        req.method === 'POST' &&
        req.url === this.hookPath &&
        this.isSecretValid(botApiSecretHeader)
      ) {
        let body = '';

        req.on('data', (chunk) => {
          body += chunk.toString();
        });

        req.on('end', async () => {
          let update: Update;

          try {
            update = JSON.parse(body);
          } catch (jsonError) {
            debug('Invalid JSON received: %O', jsonError);
            res.writeHead(400, RESPONSE_DEFAULT_HEADERS);
            return res.end('Invalid JSON');
          }

          res.writeHead(200, RESPONSE_DEFAULT_HEADERS);
          res.end('OK');

          try {
            await handleUpdate(update)
          } catch (botError) {
            debug('Error inside bot middleware chain: %O', botError);
          }
        });
      } else {
        res.writeHead(404, RESPONSE_DEFAULT_HEADERS);
        res.end('Not Found');
      }
    };
  };

  start = async (handleUpdate: (update: Update) => Promise<void>) => {
    debug('Starting standalone HTTP webhook service on port %d', this.port);

    this.server = createServer(this.createCallback(handleUpdate));

    this.server.listen(this.port, () => {
      debug('Standalone Webhook server is listening on port %d', this.port);
    });

    debug('Registering webhook URL in MAX Platform: %s', this.url);

    try {
      await this.api.subscribe(
        this.url,
        this.secret,
        this.allowedUpdates
      );
      debug('Webhook successfully registered');
    } catch (error) {
      debug('Failed to register webhook in MAX: %O', error);
      void this.stop();
      throw error;
    }
  };

  stop = async () => {
    debug('Stopping webhook service');

    if (this.server) {
      this.server.close(() => {
        debug('HTTP server stopped');
      });
      this.server = null;
    }

    try {
      await this.api.unsubscribe(this.url);
      debug('Webhook removed from MAX');
    } catch (error) {
      debug('Failed to delete webhook from MAX: %O', error);
    }
  };

  private isSecretValid(headerValue: string | string[] | undefined): boolean {
    if(!this.secret) return true

    if (!headerValue || typeof headerValue !== 'string') return false;
    const a = Buffer.from(headerValue);
    const b = Buffer.from(this.secret);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  private getWebhookUrl = (domain: string) => {
    const hasProtocol = /^https?:\/\//i.test(domain);
    const urlString = hasProtocol ? domain : `https://${domain}`;
    const preparedDomain = new URL(urlString).host;

    return `https://${preparedDomain}${this.hookPath}`
  }

  private generateTokenRelatedHash = (token: string) => createHash('sha256')
    .update(token)
    .digest('hex');
}
