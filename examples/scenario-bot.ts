import {
  Bot,
  Context,
  ScenarioEngine,
  defineScenario,
  session,
  transition,
  type ScenarioController,
  type ScenarioSession,
} from '@maxhub/max-bot-api';

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('Token must be provided');

interface RegistrationData {
  name?: string;
}

interface BotSession extends ScenarioSession {
  count?: number;
}

type RegistrationStep = 'ask-name' | 'read-name' | 'confirm';

type BotContext = Context & {
  session: BotSession;
  scenario: ScenarioController<BotContext>;
};

const saveRegistration = async (name: string) => {
  // Здесь должна быть идемпотентная запись в базу приложения.
  void name;
};

const registration = defineScenario<BotContext, RegistrationData>()<RegistrationStep>({
  id: 'registration',
  initialStep: 'ask-name',
  idleTimeoutMs: 5 * 60 * 1000,
  createData: () => ({}),
  steps: {
    'ask-name': async ({ ctx }) => {
      await ctx.reply('Как вас зовут?');
      return transition.goto('read-name');
    },
    'read-name': async ({ ctx }) => {
      const name = ctx.message?.body.text?.trim();
      if (!name) {
        await ctx.reply('Имя не должно быть пустым. Попробуйте ещё раз.');
        return transition.stay();
      }
      await ctx.reply(`Сохранить имя «${name}»? Ответьте «да».`);
      return transition.goto('confirm', { name });
    },
    confirm: async ({ ctx, data }) => {
      if (ctx.message?.body.text?.trim().toLowerCase() !== 'да') {
        await ctx.reply('Ответьте «да» или отправьте /cancel.');
        return transition.stay();
      }
      if (data.name === undefined) throw new Error('Registration name is missing');

      // При ошибке сценарий останется на confirm, и сохранение можно будет повторить.
      await saveRegistration(data.name);
      await ctx.reply(`Приятно познакомиться, ${data.name}!`);
      return transition.complete();
    },
  },
});

const bot = new Bot<BotContext>(token);
const scenarios = new ScenarioEngine<BotContext>();
scenarios.register(registration);

// Между controller и interceptor подключаются команды, доступные на любом шаге.
bot.use(session<BotSession, BotContext>());
bot.use(scenarios.controllerMiddleware());
bot.command('cancel', async (ctx, next) => {
  if (!ctx.scenario.cancel()) return next();
  await ctx.reply('Текущий диалог отменён.');
  return undefined;
});
bot.use(scenarios.interceptMiddleware());
bot.command('register', scenarios.start(registration));

bot.start();
