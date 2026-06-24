/**
 * Wizard Bot — Registration Flow
 *
 * Demonstrates WizardScene for a multi-step form:
 *   /register → (name) → (phone) → confirmation → done
 *
 * Usage:
 *   BOT_TOKEN=<token> npx ts-node examples/wizard-bot.ts
 */

import {
  Bot,
  Context,
  session,
  Stage,
  WizardScene,
  WizardContextWizard,
  type SceneContextScene,
  type WizardSession,
  type WizardSessionData,
} from '@maxhub/max-bot-api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RegistrationData {
  name?: string;
  phone?: string;
}

type MyContext = Context & {
  session: WizardSession;
  scene: SceneContextScene<MyContext, WizardSessionData>;
  wizard: WizardContextWizard<MyContext>;
};

// ─── Bootstrap ────────────────────────────────────────────────────────────────

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('BOT_TOKEN is not set');

// ─── Wizard scene (3 steps) ───────────────────────────────────────────────────

const registration = new WizardScene<MyContext>(
  'registration',

  // Шаг 0 — запрашиваем имя
  async (ctx) => {
    await ctx.reply('Шаг 1/2 — Введите ваше имя:');
    ctx.wizard.next();
  },

  // Шаг 1 — запрашиваем телефон
  async (ctx) => {
    const name = ctx.message?.body.text;
    if (!name) {
      await ctx.reply('Пожалуйста, введите имя текстом.');
      return; // остаёмся на этом шаге
    }
    (ctx.wizard.state as RegistrationData).name = name;
    await ctx.reply('Шаг 2/2 — Введите ваш телефон:');
    ctx.wizard.next();
  },

  // Шаг 2 — завершение
  async (ctx) => {
    const phone = ctx.message?.body.text;
    if (!phone) {
      await ctx.reply('Пожалуйста, введите телефон текстом.');
      return;
    }
    const data = ctx.wizard.state as RegistrationData;
    data.phone = phone;

    await ctx.reply(
      `✅ Регистрация завершена!\n\n` +
      `Имя: ${data.name}\n` +
      `Телефон: ${data.phone}`,
    );
    await ctx.scene.leave();
  },
);

// Enter/leave hooks
registration.enter((ctx) => {
  console.log(`User ${ctx.user?.user_id} entered registration wizard`);
});

registration.leave((ctx) => {
  console.log(`User ${ctx.user?.user_id} left registration wizard`);
});

// ─── Stage ────────────────────────────────────────────────────────────────────

const stage = new Stage<MyContext>([registration]);

// ─── Bot ─────────────────────────────────────────────────────────────────────

const bot = new Bot<MyContext>(token);

bot.use(session());
bot.use(stage);

bot.command('register', (ctx) => ctx.scene.enter('registration'));
bot.command('cancel', (ctx) => ctx.scene.leave());

bot.command('start', (ctx) =>
  ctx.reply('Привет!\n\n/register — начать регистрацию\n/cancel — отменить'),
);

// Catch-all: напомнить пользователю вне сцены
bot.on('message_created', (ctx) =>
  ctx.reply('Введите /register чтобы начать, или /cancel для отмены.'),
);

bot.start();
