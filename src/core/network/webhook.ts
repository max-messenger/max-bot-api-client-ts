import { createHash, randomBytes } from 'node:crypto';
import { createServer, IncomingMessage, ServerResponse, Server } from 'node:http';
import createDebug from 'debug';

import type { Api } from '../../api';
import { Update, UpdateType } from './api';

const debug = createDebug('max:webhook');

// Node.js приводит заголовки к нижнему регистру автоматически
const BOT_API_SECRET_HEADER = 'x-max-bot-api-secret';
const RESPONSE_DEFAULT_HEADERS = { 'Content-Type': 'text/plain' }

export type WebhookOptions = {
  // Внешний HTTPS домен вашего прокси (например, 'https://my-domain.com')
  domain: string;
  // Локальный порт для Node.js процесса (по умолчанию 3000)
  port?: number;
  // Кастомный роут для получения обновлений.
  // Генерируется стабильный роут от токена бота, если не передать
  path?: string;
  // Секрет, который передается в MAX
  // и проверяется в заголовке при получении ответов
  secret?: string;
}

export class Webhook {
  private server: Server | null = null;
  private readonly hookPath: string;
  private readonly port: number;
  private readonly domain: string;
  private readonly secret: string;
  private readonly url: string;

  constructor(
    private readonly api: Api,
    private readonly allowedUpdates: UpdateType[] = [],
    token: string,
    options: WebhookOptions
  ) {
    this.domain = options.domain;
    this.port = options.port || 3000;

    this.secret = options.secret || randomBytes(32).toString('hex');

    this.hookPath = options.path ?? this.generateTokenRelatedPath(token);
    this.url = `${this.domain}${this.hookPath}`;
  }

  start = async (handleUpdate: (update: Update) => Promise<void>) => {
    debug('Starting HTTP webhook service locally on port %d', this.port);

    this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const botApiSecretHeader = req.headers[BOT_API_SECRET_HEADER];

      if (
        req.method === 'POST' &&
        req.url === this.hookPath &&
        botApiSecretHeader === this.secret
      ) {
        let body = '';

        req.on('data', (chunk) => {
          body += chunk.toString();
        });

        req.on('end', async () => {
          try {
            const update: Update = JSON.parse(body);
            debug('Received update: %O', update);

            res.writeHead(200, RESPONSE_DEFAULT_HEADERS);
            res.end('OK');

            await handleUpdate(update);
          } catch (error) {
            debug('Error processing update: %O', error);
            if (!res.writableEnded) {
              res.writeHead(500, RESPONSE_DEFAULT_HEADERS);
              res.end('Internal Error');
            }
          }
        });
      } else {
        res.writeHead(404, RESPONSE_DEFAULT_HEADERS);
        res.end('Not Found');
      }
    });

    this.server.listen(this.port, () => {
      debug('Webhook server is listening locally on port %d', this.port);
    });

    debug('Registering webhook URL in MAX Platform: %s', this.url);

    try {
      await this.api.registerWebhook(
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
      await this.api.unregisterWebhook(this.url);
      debug('Webhook removed from MAX');
    } catch (error) {
      debug('Failed to delete webhook from MAX: %O', error);
    }
  };

  private generateTokenRelatedPath = (token: string) => {
    const hash = createHash('sha256')
      .update(token)
      .digest('hex');

    return `/webhook/${hash}`
  }
}
