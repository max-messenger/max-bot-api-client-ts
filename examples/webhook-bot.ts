import { Bot } from '@maxhub/max-bot-api';

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('Token not provided');

const domain = process.env.HTTPS_DOMAIN;
if (!domain) throw new Error('Domain not provided');

const bot = new Bot(token);

bot.on('message_created', (ctx) => {
  // Если в message_created нет chat_id, определить получателя ответа невозможно.
  if (ctx.chatId == null) return undefined;
  return ctx.reply(ctx.message?.body?.text ?? 'New message');
});

const secret = process.env.WEBHOOK_SECRET;

bot.start({
  mode: 'webhook',
  options: {
    domain,
    port: 3000,
    // secret опционален — передаём его, только если он задан.
    ...(secret ? { secret } : {}),
    allowedUpdates: ['message_created'],
  },
});
