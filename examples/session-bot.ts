import {
  Bot, Context, MemorySessionStore, session,
} from '@maxhub/max-bot-api';

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('Token must be provided');

interface BotSession {
  count: number;
}

type BotContext = Context & { session: BotSession };

const bot = new Bot<BotContext>(token);
const store = new MemorySessionStore<BotSession>(60 * 60 * 1000);

bot.use(session<BotSession, BotContext>({
  store,
  defaultSession: () => ({ count: 0 }),
}));

bot.command('count', async (ctx) => {
  ctx.session.count += 1;
  await ctx.reply(`Счётчик: ${ctx.session.count}`);
});

bot.start();
