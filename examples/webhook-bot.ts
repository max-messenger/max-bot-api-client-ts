import { Bot } from '@maxhub/max-bot-api';

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('Token not provided');

const domain = process.env.HTTPS_DOMAIN;
if (!domain) throw new Error('Domain not provided');

const bot = new Bot(token);

bot.on('message_created', (ctx) => ctx.reply(ctx.message.body.text ?? 'New message'));

bot.start({
  mode: 'webhook',
  options: {
    domain,
    port: 3000,
    secret: process.env.WEBHOOK_SECRET,
    allowedUpdates: ['message_created'],
  },
});