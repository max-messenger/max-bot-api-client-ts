# `6` Сессии и пошаговые сценарии

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
> падении, перезапуске или новой выкладке бота все сессии и незавершённые сценарии
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

Если сессии достаточно пустого объекта с необязательными полями, factory можно
не указывать: `session()` создаст `{}` автоматически. Для обязательных полей,
как `count` выше, задайте `defaultSession`, чтобы они сразу получили значения.

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

Для одного экземпляра бота состояние можно сохранять в SQLite. Ниже показан
упрощённый адаптер; конкретный SQLite-драйвер приложение выбирает самостоятельно:

```typescript
database.exec(`
  CREATE TABLE IF NOT EXISTS bot_sessions (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

const store: SessionStore<BotSession> = {
  get(key) {
    const row = database.prepare(
      'SELECT value FROM bot_sessions WHERE key = ?',
    ).get(key) as { value: string } | undefined;
    return row === undefined ? undefined : JSON.parse(row.value) as BotSession;
  },
  set(key, value) {
    database.prepare(`
      INSERT INTO bot_sessions (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, JSON.stringify(value));
  },
  delete(key) {
    database.prepare('DELETE FROM bot_sessions WHERE key = ?').run(key);
  },
};
```

Внешнее хранилище нужно не только для нескольких экземпляров. Оно также нужно
одному рабочему экземпляру, если сессии должны переживать перезапуск. Если бот
запущен в нескольких экземплярах, локального файла SQLite уже недостаточно: все
процессы должны использовать общее хранилище, например Redis или серверную базу
данных.

## Пошаговый сценарий

Сценарий хранит текущий шаг и временно собранные данные в сессии. Каждый шаг должен
вернуть одно из четырёх действий:

- `transition.stay()` — остаться на текущем шаге;
- `transition.goto('step')` — перейти на другой шаг;
- `transition.complete()` — успешно завершить сценарий;
- `transition.cancel()` — отменить сценарий.

Пример регистрации:

```typescript
interface RegistrationData {
  name?: string;
}

interface BotSession extends ScenarioSession {}

type RegistrationStep = 'ask-name' | 'read-name' | 'confirm';

type BotContext = Context & {
  session: BotSession;
  scenario: ScenarioController<BotContext>;
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

Подключение сценария:

```typescript
const scenarios = new ScenarioEngine<BotContext>();
scenarios.register(registration);

bot.use(session<BotSession, BotContext>());
bot.use(scenarios.controllerMiddleware());

bot.command('help', (ctx) => ctx.reply('Справка'));
bot.command('cancel', async (ctx) => {
  const canceled = ctx.scenario.cancel();
  await ctx.reply(canceled ? 'Сценарий отменён.' : 'Активного сценария нет.');
});

bot.use(scenarios.interceptMiddleware());
bot.command('register', scenarios.start(registration));
```

Порядок подключения важен:

1. `session()` загружает состояние пользователя.
2. `controllerMiddleware()` добавляет методы управления сценарием.
3. Глобальные команды `/help` и `/cancel` остаются доступными на любом шаге.
4. `interceptMiddleware()` передаёт остальные события активному сценарию.

Если глобальные команды не нужны, можно использовать короткую запись:

```typescript
bot.use(scenarios);
```

## Ошибки на шаге

Если обработчик завершился с ошибкой, пользователь остаётся на прежнем шаге и
может повторить действие.

Сначала сохраняйте данные, затем завершайте сценарий:

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

Эти методы необязательны. Для большинства ботов достаточно `use`, `on`, `command`,
`hears`, `action`, session и пошаговых сценариев.
