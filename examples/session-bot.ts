/**
 * Session Bot
 *
 * Demonstrates ctx.session and ctx.state:
 * - Counts total messages per user via session (persisted across updates)
 * - Measures middleware execution time via ctx.state (per-update)
 *
 * Usage:
 *   BOT_TOKEN=<token> npx ts-node examples/session-bot.ts
 */

import { Bot, Context, session, MemorySessionStore } from '@maxhub/max-bot-api';

// ─── Session shape ────────────────────────────────────────────────────────────

interface MySession {
  messageCount: number;
  lastText: string | null;
}

// ─── Extended context ─────────────────────────────────────────────────────────

type MyContext = Context & { session: MySession };

// ─── Bootstrap ────────────────────────────────────────────────────────────────

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('BOT_TOKEN is not set');

const bot = new Bot<MyContext>(token);

// ─── Middleware: timing via ctx.state ─────────────────────────────────────────

bot.use((ctx, next) => {
  ctx.state.startedAt = Date.now();
  return next();
});

// ─── Session (per-user, in memory with 1-hour TTL) ────────────────────────────

const store = new MemorySessionStore<MySession>(60 * 60 * 1000);

bot.use(
  session<MySession, MyContext>({
    store,
    defaultSession: () => ({ messageCount: 0, lastText: null }),
  }),
);

// ─── Commands ─────────────────────────────────────────────────────────────────

bot.command('start', (ctx) =>
  ctx.reply('Привет! Отправь мне любое сообщение, и я буду его считать.'),
);

bot.command('stats', async (ctx) => {
  const { messageCount, lastText } = ctx.session;
  await ctx.reply(
    `📊 Статистика:\n` +
    `• Сообщений: ${messageCount}\n` +
    `• Последнее: ${lastText ?? '—'}`,
  );
});

bot.command('reset', async (ctx) => {
  ctx.session.messageCount = 0;
  ctx.session.lastText = null;
  await ctx.reply('Счётчик сброшен.');
});

// ─── Message handler ──────────────────────────────────────────────────────────

bot.on('message_created', async (ctx) => {
  const text = ctx.message?.body.text ?? '';
  ctx.session.messageCount++;
  ctx.session.lastText = text.slice(0, 80);

  const elapsed = Date.now() - (ctx.state.startedAt as number);

  await ctx.reply(
    `Сообщение #${ctx.session.messageCount} получено за ${elapsed} мс\n` +
    `Текст: "${text}"`,
  );
});

// ─── Start ────────────────────────────────────────────────────────────────────

bot.start();
