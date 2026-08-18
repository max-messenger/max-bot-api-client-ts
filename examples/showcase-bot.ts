import { randomUUID } from 'node:crypto';
import {
  Bot,
  Context,
  ConversationEngine,
  Keyboard,
  MemorySessionStore,
  anyOf,
  defineConversation,
  fmt,
  session,
  transition,
  type ConversationController,
  type ConversationSession,
} from '@maxhub/max-bot-api';

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('BOT_TOKEN must be provided');

const positiveEnv = (name: string, fallback: number) => {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive number`);
  }
  return value;
};

const sessionTtlMs = positiveEnv('SHOWCASE_SESSION_TTL_MS', 60 * 60 * 1000);
const conversationTtlMs = positiveEnv('SHOWCASE_CONVERSATION_TTL_MS', 10 * 60 * 1000);

const products = {
  coffee: { title: 'Кофе', price: 250 },
  tea: { title: 'Чай', price: 180 },
  cake: { title: 'Чизкейк', price: 320 },
} as const;

type ProductId = keyof typeof products;

interface CartLine {
  productId: ProductId;
  quantity: number;
}

interface BotSession extends ConversationSession {
  seenUpdates: number;
  cart: CartLine[];
  failNextOrderSave: boolean;
}

type BotContext = Context & {
  session: BotSession;
  conversation: ConversationController<BotContext>;
};

interface Profile {
  name: string;
  phone: string;
  location: { latitude: number; longitude: number };
}

interface Order {
  id: string;
  owner: string;
  items: CartLine[];
  total: number;
  delivery: Delivery;
}

// These maps imitate an application database only for this executable example.
// A production bot should inject a durable repository here.
const profiles = new Map<string, Profile>();
const orders = new Map<string, Order>();

const userKey = (ctx: BotContext) => `${ctx.user?.user_id ?? 'unknown'}:${ctx.chatId ?? 'unknown'}`;

const keyboard = (buttons: ReturnType<typeof Keyboard.button.callback>[], columns = 2) => {
  return [Keyboard.inlineKeyboard(buttons, { columns })];
};

const formatMoney = (value: number) => `${value} ₽`;

const cartTotal = (items: CartLine[]) => items.reduce((total, line) => {
  return total + products[line.productId].price * line.quantity;
}, 0);

const cartText = (items: CartLine[]) => {
  if (items.length === 0) return 'Корзина пуста.';
  const lines = items.map((line) => {
    const product = products[line.productId];
    return `• ${product.title} × ${line.quantity} — ${formatMoney(product.price * line.quantity)}`;
  });
  return [fmt.boldHtml('Корзина'), ...lines, '', `Итого: ${fmt.boldHtml(formatMoney(cartTotal(items)))}`]
    .join('\n');
};

const cartReplyExtra = (items: CartLine[]) => {
  if (items.length === 0) return { format: 'html' as const };
  return {
    format: 'html' as const,
    attachments: keyboard([
      Keyboard.button.callback('Оформить заказ', 'checkout:start'),
      Keyboard.button.callback('Очистить', 'cart:clear'),
    ], 1),
  };
};

const addToCart = (sessionState: BotSession, productId: ProductId) => {
  const current = sessionState.cart.find((line) => line.productId === productId);
  if (current === undefined) {
    sessionState.cart.push({ productId, quantity: 1 });
  } else {
    current.quantity += 1;
  }
};

interface RegistrationData {
  name?: string;
  phone?: string;
  location?: { latitude: number; longitude: number };
}

type RegistrationStep =
  | 'ask-name'
  | 'read-name'
  | 'read-contact'
  | 'read-location'
  | 'confirm';

const registrationSummary = (data: RegistrationData) => [
  fmt.boldHtml('Проверьте данные'),
  `Имя: ${fmt.escapeHtml(data.name ?? '—')}`,
  `Телефон: ${fmt.escapeHtml(data.phone ?? '—')}`,
  `Координаты: ${data.location?.latitude ?? '—'}, ${data.location?.longitude ?? '—'}`,
].join('\n');

const testLocation = { latitude: 55.7558, longitude: 37.6173 };
const registrationLocationKeyboard = Keyboard.inlineKeyboard([
  [Keyboard.button.requestGeoLocation('Поделиться геопозицией')],
  [Keyboard.button.callback('Использовать тестовую геопозицию', 'registration:location:test')],
]);

const registration = defineConversation<BotContext, RegistrationData>()<RegistrationStep>({
  id: 'registration',
  initialStep: 'ask-name',
  idleTimeoutMs: conversationTtlMs,
  createData: () => ({}),
  steps: {
    'ask-name': async ({ ctx }) => {
      await ctx.reply('Как вас зовут?');
      return transition.goto('read-name');
    },
    'read-name': async ({ ctx }) => {
      const name = ctx.message?.body.text?.trim();
      if (!name || name.startsWith('/')) {
        await ctx.reply('Отправьте имя обычным текстовым сообщением.');
        return transition.stay();
      }
      await ctx.reply('Теперь поделитесь контактом кнопкой ниже.', {
        attachments: [Keyboard.inlineKeyboard([
          [Keyboard.button.requestContact('Поделиться контактом')],
        ])],
      });
      return transition.goto('read-contact', { name });
    },
    'read-contact': async ({ ctx }) => {
      const phone = ctx.contactInfo?.tel;
      if (!phone) {
        await ctx.reply('Нужен контакт, отправленный кнопкой.', {
          attachments: [Keyboard.inlineKeyboard([
            [Keyboard.button.requestContact('Поделиться контактом')],
          ])],
        });
        return transition.stay();
      }
      await ctx.reply('И последнее: отправьте геопозицию.', {
        attachments: [registrationLocationKeyboard],
      });
      return transition.goto('read-location', { phone });
    },
    'read-location': async ({ ctx, data }) => {
      const useTestLocation = ctx.callback?.payload === 'registration:location:test';
      const location = useTestLocation ? testLocation : ctx.location;
      if (!location) {
        await ctx.reply('Поделитесь геопозицией или используйте тестовые координаты.', {
          attachments: [registrationLocationKeyboard],
        });
        return transition.stay();
      }
      if (useTestLocation) {
        await ctx.answerOnCallback({ notification: 'Используются тестовые координаты' });
      }
      const nextData = { ...data, location };
      await ctx.reply(registrationSummary(nextData), {
        format: 'html',
        attachments: keyboard([
          Keyboard.button.callback('Сохранить', 'registration:confirm'),
          Keyboard.button.callback('Изменить', 'registration:edit'),
        ]),
      });
      return transition.goto('confirm', { location });
    },
    confirm: async ({ ctx, data }) => {
      const payload = ctx.callback?.payload;
      if (payload === 'registration:edit') {
        await ctx.answerOnCallback({ notification: 'Введите данные заново' });
        await ctx.reply('Хорошо, как вас зовут?');
        return transition.goto('read-name');
      }
      if (payload !== 'registration:confirm') {
        await ctx.reply('Используйте кнопки «Сохранить» или «Изменить».');
        return transition.stay();
      }
      if (!data.name || !data.phone || !data.location) {
        throw new Error('Registration data is incomplete');
      }

      profiles.set(userKey(ctx), {
        name: data.name,
        phone: data.phone,
        location: data.location,
      });
      await ctx.answerOnCallback({ notification: 'Профиль сохранён' });
      await ctx.reply(`Готово, ${fmt.escapeHtml(data.name)}! Регистрация завершена.`, {
        format: 'html',
      });
      return transition.complete();
    },
  },
});

type Delivery = 'pickup' | 'courier';

interface CheckoutData {
  orderId: string;
  items: CartLine[];
  total: number;
  delivery?: Delivery;
}

type CheckoutStep = 'review' | 'select-delivery' | 'confirm';

const deliveryKeyboard = () => keyboard([
  Keyboard.button.callback('Самовывоз', 'checkout:delivery:pickup'),
  Keyboard.button.callback('Курьер', 'checkout:delivery:courier'),
]);

const checkout = defineConversation<BotContext, CheckoutData>()<CheckoutStep>({
  id: 'checkout',
  initialStep: 'review',
  idleTimeoutMs: conversationTtlMs,
  createData: (ctx) => ({
    orderId: randomUUID(),
    items: structuredClone(ctx.session.cart),
    total: cartTotal(ctx.session.cart),
  }),
  steps: {
    review: async ({ ctx, data }) => {
      if (data.items.length === 0) {
        await ctx.reply('Корзина пуста — сначала добавьте товары через /catalog.');
        return transition.complete();
      }
      await ctx.reply(`${cartText(data.items)}\n\nВыберите способ получения:`, {
        format: 'html',
        attachments: deliveryKeyboard(),
      });
      return transition.goto('select-delivery');
    },
    'select-delivery': async ({ ctx, data }) => {
      const match = /^checkout:delivery:(pickup|courier)$/.exec(ctx.callback?.payload ?? '');
      if (!match) {
        await ctx.reply('Выберите способ получения кнопкой.', {
          attachments: deliveryKeyboard(),
        });
        return transition.stay();
      }
      const delivery = match[1] as Delivery;
      await ctx.answerOnCallback({ notification: 'Способ получения выбран' });
      await ctx.reply([
        fmt.boldHtml('Подтверждение заказа'),
        `Номер: ${fmt.codeHtml(data.orderId)}`,
        `Получение: ${delivery === 'pickup' ? 'самовывоз' : 'курьер'}`,
        `Сумма: ${fmt.boldHtml(formatMoney(data.total))}`,
      ].join('\n'), {
        format: 'html',
        attachments: keyboard([
          Keyboard.button.callback('Оформить', 'checkout:confirm'),
          Keyboard.button.callback('Назад', 'checkout:back'),
        ]),
      });
      return transition.goto('confirm', { delivery });
    },
    confirm: async ({ ctx, data }) => {
      const payload = ctx.callback?.payload;
      if (payload === 'checkout:back') {
        await ctx.answerOnCallback({ notification: 'Выберите другой способ' });
        await ctx.reply('Выберите способ получения:', { attachments: deliveryKeyboard() });
        return transition.goto('select-delivery');
      }
      if (payload !== 'checkout:confirm') {
        await ctx.reply('Подтвердите заказ кнопкой или вернитесь назад.');
        return transition.stay();
      }
      if (data.delivery === undefined) throw new Error('Delivery method is missing');

      // The flag demonstrates retry semantics: a failed step is not completed.
      if (ctx.session.failNextOrderSave) {
        ctx.session.failNextOrderSave = false;
        throw new Error('Simulated order repository failure');
      }

      // A stable order id makes the fake write idempotent if an update is retried.
      if (!orders.has(data.orderId)) {
        orders.set(data.orderId, {
          id: data.orderId,
          owner: userKey(ctx),
          items: data.items,
          total: data.total,
          delivery: data.delivery,
        });
      }
      ctx.session.cart = [];
      await ctx.answerOnCallback({ notification: 'Заказ оформлен' });
      await ctx.reply(`Заказ ${fmt.codeHtml(data.orderId)} сохранён.`, { format: 'html' });
      return transition.complete();
    },
  },
});

const bot = new Bot<BotContext>(token);
const conversations = new ConversationEngine<BotContext>();
conversations.register(registration).register(checkout);

bot.catch(async (error, ctx) => {
  // Keep polling alive in this demo and show that the current step can be retried.
  // eslint-disable-next-line no-console
  console.error(`[${String(ctx.state.requestId)}]`, error);
  if (ctx.callback !== undefined) {
    await ctx.answerOnCallback({ notification: 'Не удалось выполнить действие' });
  }
  await ctx.reply('Операция не выполнена. Состояние сохранено — повторите действие или /cancel.');
});

// state lives for one update; session lives between updates with the same user/chat key.
bot.use(async (ctx, next) => {
  ctx.state.requestId = randomUUID();
  await next();
});
bot.on(anyOf('message_created', 'message_callback'), async (ctx, next) => {
  ctx.state.interactive = true;
  return next();
});
bot.tap(async (ctx) => {
  // eslint-disable-next-line no-console
  console.log(`[${String(ctx.state.requestId)}] ${ctx.updateType}`);
});
bot.use(session<BotSession, BotContext>({
  store: new MemorySessionStore<BotSession>(sessionTtlMs),
  defaultSession: () => ({
    seenUpdates: 0,
    cart: [],
    failNextOrderSave: false,
  }),
}));
bot.use(async (ctx, next) => {
  ctx.session.seenUpdates += 1;
  return next();
});
bot.use(conversations.controllerMiddleware());

const commands = [
  { name: 'start', description: 'Показать возможности бота' },
  { name: 'help', description: 'Показать список команд' },
  { name: 'register', description: 'Пройти регистрацию' },
  { name: 'profile', description: 'Показать сохранённый профиль' },
  { name: 'catalog', description: 'Открыть каталог товаров' },
  { name: 'cart', description: 'Показать корзину' },
  { name: 'checkout', description: 'Оформить заказ' },
  { name: 'orders', description: 'Показать оформленные заказы' },
  { name: 'state', description: 'Показать текущую сессию' },
  { name: 'cancel', description: 'Отменить активный сценарий' },
  { name: 'reset', description: 'Очистить тестовую сессию' },
  { name: 'fail_next_order', description: 'Включить тестовую ошибку заказа' },
];

const help = [
  fmt.boldHtml('Showcase-команды'),
  ...commands.map(({ name, description }) => `/${name} — ${description}`),
].join('\n');

const welcome = 'Привет! Здесь можно проверить регистрацию и оформление заказа. Справка: /help';

// These commands remain available even while a conversation owns other updates.
bot.on('bot_started', (ctx) => ctx.reply(welcome));
bot.command('start', (ctx) => ctx.reply(welcome));
bot.command('help', (ctx) => ctx.reply(help, { format: 'html' }));
bot.command('cancel', async (ctx) => {
  const canceled = ctx.conversation.cancel();
  await ctx.reply(canceled ? 'Активный сценарий отменён.' : 'Активного сценария нет.');
});
bot.command('state', async (ctx) => {
  const snapshot = fmt.escapeHtml(JSON.stringify(ctx.session, null, 2));
  await ctx.reply(fmt.preHtml(snapshot, 'json'), { format: 'html' });
});
bot.command('reset', async (ctx) => {
  ctx.conversation.cancel();
  ctx.session.cart = [];
  ctx.session.failNextOrderSave = false;
  await ctx.reply('Корзина и активный сценарий сброшены.');
});
bot.command('fail_next_order', async (ctx) => {
  ctx.session.failNextOrderSave = true;
  await ctx.reply('Следующая попытка сохранить заказ завершится тестовой ошибкой.');
});
bot.command('profile', async (ctx) => {
  const profile = profiles.get(userKey(ctx));
  if (profile === undefined) {
    await ctx.reply('Профиля нет. Запустите /register.');
    return;
  }
  await ctx.reply(registrationSummary(profile), { format: 'html' });
});
bot.command('orders', async (ctx) => {
  const owner = userKey(ctx);
  const ownOrders = [...orders.values()].filter((order) => order.owner === owner);
  if (ownOrders.length === 0) {
    await ctx.reply('Заказов пока нет.');
    return;
  }
  const lines = ownOrders.map((order) => {
    return `${fmt.codeHtml(order.id)} · ${formatMoney(order.total)} · ${order.delivery}`;
  });
  await ctx.reply([fmt.boldHtml('Заказы'), ...lines].join('\n'), { format: 'html' });
});

// Active conversations consume non-global updates after this point.
bot.use(conversations.interceptMiddleware());

bot.command('register', conversations.start(registration));
bot.command('catalog', async (ctx) => {
  await ctx.reply('Добавьте товары в корзину:', {
    attachments: keyboard([
      Keyboard.button.callback('Кофе · 250 ₽', 'cart:add:coffee'),
      Keyboard.button.callback('Чай · 180 ₽', 'cart:add:tea'),
      Keyboard.button.callback('Чизкейк · 320 ₽', 'cart:add:cake'),
      Keyboard.button.callback('Показать корзину', 'cart:show'),
    ]),
  });
});
bot.action(/^cart:add:(coffee|tea|cake)$/, async (ctx) => {
  const productId = ctx.match?.[1] as ProductId;
  addToCart(ctx.session, productId);
  await ctx.answerOnCallback({
    notification: `${products[productId].title} добавлен в корзину`,
  });
});
bot.action('cart:show', async (ctx) => {
  await ctx.answerOnCallback({ notification: 'Корзина обновлена' });
  await ctx.reply(cartText(ctx.session.cart), cartReplyExtra(ctx.session.cart));
});
bot.action('cart:clear', async (ctx) => {
  ctx.session.cart = [];
  await ctx.answerOnCallback({ notification: 'Корзина очищена' });
  await ctx.reply('Корзина пуста.');
});
bot.action('checkout:start', async (ctx) => {
  await ctx.answerOnCallback({ notification: 'Переходим к оформлению' });
  await ctx.conversation.start(checkout);
});
bot.command('cart', (ctx) => {
  return ctx.reply(cartText(ctx.session.cart), cartReplyExtra(ctx.session.cart));
});
bot.command('checkout', conversations.start(checkout));

bot.on('message_created', (ctx) => ctx.reply('Команда не распознана. Используйте /help.'));

const run = async () => {
  // MAX uses this list to show command descriptions when the user enters `/`.
  await bot.api.setMyCommands(commands);
  await bot.start({
    allowedUpdates: ['bot_started', 'message_created', 'message_callback'],
  });
};

run().catch((error: unknown) => {
  // Startup errors happen before bot.catch() can handle an update.
  // eslint-disable-next-line no-console
  console.error('Failed to start showcase bot', error);
  process.exitCode = 1;
});
