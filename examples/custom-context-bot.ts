import { Bot, Context } from '@maxhub/max-bot-api';

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('Token must be provided');

class CustomContext extends Context {
  reply(...options: Parameters<Context['reply']>) {
    console.log(`Reply to ${this.chatId} with options: ${options}`);
    return super.reply(...options);
  }
}

const bot = new Bot(token, { contextType: CustomContext });

bot.api.setMyCommands([{
  name: 'start',
}]);

bot.command('start', (ctx) => {
  return ctx.reply('Hello!');
});

bot.start();
