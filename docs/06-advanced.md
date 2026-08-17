# `6` Состояние, диалоги и расширенный middleware

## Состояние одного update

`ctx.state` передаёт данные только внутри текущей middleware-цепочки:

```typescript
bot.use(async (ctx, next) => {
  ctx.state.startedAt = Date.now();
  return next();
});
```

Данные между update храните в session. Пользователей, корзины, заказы и другие
бизнес-сущности храните в основной базе данных.

## Session

```typescript
import { Bot, Context, session } from '@maxhub/max-bot-api';

interface BotSession {
  count: number;
}

type BotContext = Context & { session: BotSession };
const bot = new Bot<BotContext>(process.env.BOT_TOKEN!);

bot.use(session<BotSession, BotContext>({
  defaultSession: () => ({ count: 0 }),
}));

bot.command('count', async (ctx) => {
  ctx.session.count += 1;
  await ctx.reply(`Сообщений: ${ctx.session.count}`);
});
```

По умолчанию ключ имеет вид `<user_id>:<chat_id>`. Если один из идентификаторов
равен `null` или `undefined`, session для update не создаётся. Обновления одного
ключа выполняются последовательно внутри процесса.

`MemorySessionStore` подходит для разработки и одного экземпляра приложения:

```typescript
const store = new MemorySessionStore<BotSession>(60 * 60 * 1000);
```

Внешнее хранилище реализует три операции:

```typescript
const store: SessionStore<BotSession> = {
  get: (key) => database.sessions.get(key),
  set: (key, value) => database.sessions.set(key, value),
  delete: (key) => database.sessions.delete(key),
};
```

Простой контракт не координирует несколько replica. При горизонтальном
масштабировании сериализацию или атомарное обновление одного ключа обеспечивает
адаптер хранилища либо инфраструктура приложения.

## Именованные диалоги

Conversation хранит прогресс внутри session:

```typescript
{
  conversation: {
    id: 'registration',
    step: 'confirm',
    data: { name: 'Анна' },
    expiresAt: 1786360000000,
  },
}
```

Шаг возвращает один явный переход:

- `transition.stay(patch?)` — остаться на текущем шаге;
- `transition.goto(step, patch?)` — перейти на именованный шаг;
- `transition.complete()` — завершить диалог;
- `transition.cancel()` — отменить диалог.

```typescript
interface RegistrationData {
  name?: string;
}

interface BotSession extends ConversationSession {}

type Step = 'ask-name' | 'read-name' | 'confirm';

type BotContext = Context & {
  session: BotSession;
  conversation: ConversationController<BotContext>;
};

const registration = defineConversation<BotContext, RegistrationData>()<Step>({
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
      if (!name) return transition.stay();
      await ctx.reply('Подтвердите имя');
      return transition.goto('confirm', { name });
    },

    confirm: async ({ ctx, data }) => {
      // Критическая операция выполняется до удаления состояния диалога.
      await saveRegistrationToDatabase(data);
      await ctx.reply('Регистрация завершена');
      return transition.complete();
    },
  },
});

const conversations = new ConversationEngine<BotContext>();
conversations.register(registration);

bot.use(session<BotSession, BotContext>({ defaultSession: () => ({}) }));
bot.use(conversations.controllerMiddleware());

// Эти команды выполняются даже при активном диалоге.
bot.command('cancel', async (ctx, next) => {
  if (!ctx.conversation.cancel()) return next();
  await ctx.reply('Диалог отменён');
  return undefined;
});
bot.help((ctx) => ctx.reply('Справка доступна на любом шаге'));

bot.use(conversations.interceptMiddleware());
bot.command('register', conversations.start(registration));
```

Порядок middleware важен: `session()` подключается до ConversationEngine.
`controllerMiddleware()` добавляет `ctx.conversation`, глобальные команды получают
возможность обработать update, а `interceptMiddleware()` после них направляет
оставшийся update в активный диалог. `ctx.conversation.current` содержит ID
активного диалога, `cancel()` удаляет его состояние и возвращает `true`; если
диалога не было, возвращается `false`.

Для простого бота без глобальных команд остаётся сокращённая форма
`bot.use(conversations)`: метод `middleware()` последовательно выполняет оба слоя.
В таком режиме активный диалог получает update раньше следующих обработчиков.

Если команда относится только к одному сценарию, её можно оставить в
`definition.intercept`. Он выполняется перед каждым шагом этого definition.

Если шаг выбросил ошибку, его прежнее состояние остаётся в session. Записи в
бизнес-БД всё равно должны быть идемпотентными: процесс может завершиться после
успешной записи, но до сохранения session.

### Соответствие Scenes и Wizard из PR #233

| Возможность PR | Лаконичный API |
|---|---|
| `Stage.register(scene)` | `conversations.register(definition)` |
| `scene.enter(id)` | `ctx.conversation.start(definition)` |
| `scene.leave()` | `transition.complete()` или `transition.cancel()` |
| `scene.reenter()` | `transition.goto(initialStep)` |
| `scene.current` | `ctx.session.conversation?.id` |
| `scene.state` | `data` и patch в transition |
| `SceneOptions.ttl` | `idleTimeoutMs` |
| enter handler | `initialStep` |
| leave handler | код последнего шага до `complete()` |
| `wizard.next/back/selectStep` | `transition.goto('step-name')` |
| default scene | fallback middleware, запускающий выбранный conversation |

Именованные шаги не зависят от позиции в массиве, поэтому добавление нового шага
не сдвигает сохранённые диалоги.

## Маршрутизация без отдельного Router

`Composer.dispatch` покрывает Router из PR #233 и принимает необязательный patch
для `ctx.state`:

```typescript
bot.dispatch(
  async (ctx) => {
    const account = await loadAccount(ctx.user!.user_id);
    if (!account) return null;
    return { route: account.role, state: { account } };
  },
  {
    admin: adminHandlers,
    customer: customerHandlers,
  },
  guestHandlers,
);
```

`null`, `undefined` и неизвестный во время выполнения маршрут направляются в
fallback.

## Дополнительные операции Composer

- `drop(predicate)` — прекращает обработку совпавшего update;
- `fork(middleware)` — выполняет ветвь параллельно и ожидает обе ветви;
- `tap(middleware)` — выполняет side effect и продолжает цепочку;
- `lazy(factory)` — выбирает middleware для текущего Context;
- `branch(predicate, yes, no)` — выбирает одну из двух ветвей;
- `optional(predicate, ...middleware)` — условно выполняет middleware;
- `dispatch(route, handlers, fallback?)` — выбирает обработчик;
- `help()` и `settings()` — сокращения для команд.

Триггер `command`, `hears` или `action` может быть функцией, получающей Context:

```typescript
bot.hears(
  (text, ctx) => ctx.chatId === ADMIN_CHAT_ID ? /^status$/i.exec(text) : null,
  adminStatusHandler,
);
```

## Фильтры

```typescript
bot.on(anyOf('message_created', 'message_edited'), handler);
bot.on(allOf('message_created', createdMessageBodyHas('text')), textHandler);
bot.on(messageCallback, callbackHandler);
bot.on(messageEdited, editedHandler);
```

## Форматирование

Пользовательские значения обязательно экранируйте:

```typescript
await ctx.reply(`${fmt.bold('Привет!')} ${fmt.escape(userInput)}`, {
  format: 'markdown',
});

await ctx.reply(fmt.boldHtml(`Привет, ${fmt.escapeHtml(userInput)}`), {
  format: 'html',
});
```

## Клавиатура

```typescript
const keyboard = Keyboard.inlineKeyboard(
  [button1, button2, button3, button4],
  { columns: 2 },
);
```

`wrap(button, index, currentRow)` задаёт собственный перенос. Кнопки с локальным
полем `hide: true` не отправляются в MAX. Плоский массив по умолчанию размещает
по одной кнопке в строке.
