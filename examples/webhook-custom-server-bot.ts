import { createServer } from 'node:http';
import { Bot, Webhook } from '@maxhub/max-bot-api';

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('Token not provided');

const domain = process.env.HTTPS_DOMAIN;
if (!domain) throw new Error('Domain not provided');

const bot = new Bot(token);

bot.on('message_created', (ctx) =>
  ctx.reply(ctx.message.body.text ?? 'New message')
);

const path = `/webhook/${Webhook.generateTokenRelatedHash(token)}`;
const secret = process.env.WEBHOOK_SECRET;

const handleUpdate = bot.webhookCallback({
  domain,
  path,
  secret,
  allowedUpdates: ['message_created'],
});

createServer(handleUpdate).listen(3000, async () => {
  const url = Webhook.getWebhookUrl(domain, path);
  await bot.api.subscribe(url, secret, ['message_created']);
  await Webhook.clearSubscriptions(bot.api, url);
});