import {
  Bot,
  Context,
  ConversationEngine,
  defineConversation,
  session,
  transition,
  type ConversationController,
  type ConversationSession,
} from '@maxhub/max-bot-api';

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('Token must be provided');

interface RegistrationData {
  name?: string;
}

interface BotSession extends ConversationSession {
  count?: number;
}

type RegistrationStep = 'ask-name' | 'read-name' | 'confirm';

type BotContext = Context & {
  session: BotSession;
  conversation: ConversationController<BotContext>;
};

const saveRegistration = async (name: string) => {
  // Replace with an idempotent write to the application's database.
  void name;
};

const registration = defineConversation<BotContext, RegistrationData>()<RegistrationStep>({
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

      // If this throws, the conversation remains on the confirm step for retry.
      await saveRegistration(data.name);
      await ctx.reply(`Приятно познакомиться, ${data.name}!`);
      return transition.complete();
    },
  },
});

const bot = new Bot<BotContext>(token);
const conversations = new ConversationEngine<BotContext>();
conversations.register(registration);

// Conversation progress is stored by the session middleware. Splitting the
// controller and interceptor leaves a place for commands shared by all flows.
bot.use(session<BotSession, BotContext>({ defaultSession: () => ({}) }));
bot.use(conversations.controllerMiddleware());
bot.command('cancel', async (ctx, next) => {
  if (!ctx.conversation.cancel()) return next();
  await ctx.reply('Текущий диалог отменён.');
  return undefined;
});
bot.use(conversations.interceptMiddleware());
bot.command('register', conversations.start(registration));

bot.start();
