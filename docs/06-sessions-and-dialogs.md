# `6` Сессии и пошаговые диалоги

Этот раздел нужен, если бот должен помнить предыдущие сообщения пользователя.
Например, при регистрации, оформлении заказа или заполнении анкеты.

## Где хранить данные

| Что нужно сохранить | Где хранить |
|---|---|
| Данные только для обработки текущего события | `ctx.state` |
| Корзина, выбранный пункт меню или текущий шаг | `ctx.session` |
| Пользователи, заказы и другие постоянные данные | В базе приложения |

### Данные текущего события

`ctx.state` позволяет передать значение следующему обработчику:

```typescript
bot.use(async (ctx, next) => {
  ctx.state.startedAt = Date.now();
  return next();
});
```

После завершения обработки события эти данные удаляются.

## Сессия

Сессия сохраняет небольшое состояние между сообщениями одного пользователя:

> [!WARNING]
> Если параметр `store` не указан, `session()` использует `MemorySessionStore`.
> Его данные находятся только в памяти запущенного процесса: при остановке,
> падении, перезапуске или новой выкладке бота все сессии и незавершённые диалоги
> будут потеряны. Для рабочего бота используйте внешнее хранилище.

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
  await ctx.reply(`Счётчик: ${ctx.session.count}`);
});
```

По умолчанию сессия привязана к пользователю и чату. Сообщения одного пользователя
внутри одного процесса обрабатываются по очереди, поэтому одновременные нажатия не
должны терять изменения сессии.

### Хранилище сессий

Встроенное хранилище подходит для разработки, тестов и временного локального
запуска:

```typescript
const store = new MemorySessionStore<BotSession>(60 * 60 * 1000);
```

Число в конструкторе задаёт время хранения сессии в миллисекундах. TTL удаляет
неактивные записи, но не сохраняет их на диск: после завершения процесса данные
из `MemorySessionStore` пропадут независимо от значения TTL.

Для рабочего бота можно подключить своё хранилище:

```typescript
const store: SessionStore<BotSession> = {
  get: (key) => database.sessions.get(key),
  set: (key, value) => database.sessions.set(key, value),
  delete: (key) => database.sessions.delete(key),
};
```

Внешнее хранилище нужно не только для нескольких экземпляров. Оно также нужно
одному рабочему экземпляру, если сессии должны переживать перезапуск. Если бот
запущен в нескольких экземплярах, все они должны использовать одно общее
хранилище, например Redis или базу данных.

## Пошаговый диалог

Диалог хранит текущий шаг и временно собранные данные в сессии. Каждый шаг должен
вернуть одно из четырёх действий:

- `transition.stay()` — остаться на текущем шаге;
- `transition.goto('step')` — перейти на другой шаг;
- `transition.complete()` — успешно завершить диалог;
- `transition.cancel()` — отменить диалог.

Пример регистрации:

```typescript
interface RegistrationData {
  name?: string;
}

interface BotSession extends ConversationSession {}

type RegistrationStep = 'ask-name' | 'read-name' | 'confirm';

type BotContext = Context & {
  session: BotSession;
  conversation: ConversationController<BotContext>;
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
          await ctx.reply('Имя не должно быть пустым.');
          return transition.stay();
        }
        await ctx.reply(`Сохранить имя «${name}»?`);
        return transition.goto('confirm', { name });
      },

      confirm: async ({ ctx, data }) => {
        await saveRegistration(data);
        await ctx.reply('Регистрация завершена.');
        return transition.complete();
      },
    },
});
```

Подключение диалога:

```typescript
const conversations = new ConversationEngine<BotContext>();
conversations.register(registration);

bot.use(session<BotSession, BotContext>({
  defaultSession: () => ({}),
}));
bot.use(conversations.controllerMiddleware());

bot.command('help', (ctx) => ctx.reply('Справка'));
bot.command('cancel', async (ctx) => {
  const canceled = ctx.conversation.cancel();
  await ctx.reply(canceled ? 'Диалог отменён.' : 'Активного диалога нет.');
});

bot.use(conversations.interceptMiddleware());
bot.command('register', conversations.start(registration));
```

Порядок подключения важен:

1. `session()` загружает состояние пользователя.
2. `controllerMiddleware()` добавляет методы управления диалогом.
3. Глобальные команды `/help` и `/cancel` остаются доступными на любом шаге.
4. `interceptMiddleware()` передаёт остальные события активному диалогу.

Если глобальные команды не нужны, можно использовать короткую запись:

```typescript
bot.use(conversations);
```

## Ошибки на шаге

Если обработчик завершился с ошибкой, пользователь остаётся на прежнем шаге и
может повторить действие.

Сначала сохраняйте данные, затем завершайте диалог:

```typescript
await orders.create({ orderId, cart });
return transition.complete();
```

Одно событие иногда может прийти повторно. Используйте уникальный идентификатор
операции, чтобы не создать второй заказ или профиль.

## Дополнительные обработчики

`Composer` также позволяет:

- выполнить код только при условии через `branch()` или `optional()`;
- выбрать обработчик по значению через `dispatch()`;
- выполнить дополнительное действие через `tap()`;
- подобрать обработчик во время обработки события через `lazy()`;
- отфильтровать события через `anyOf()` и `allOf()`.

Эти методы необязательны. Для большинства ботов достаточно `use`, `command`,
`hears`, `action`, session и пошаговых диалогов.
