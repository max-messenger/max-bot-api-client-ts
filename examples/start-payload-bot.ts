import { Bot } from '@maxhub/max-bot-api';

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('Token not provided');

const bot = new Bot(token);

bot.on('bot_started', async (ctx) => {
  return ctx.reply(`Bot started with payload: ${ctx.startPayload}`);
});

bot.start();
