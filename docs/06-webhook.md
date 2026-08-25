# `6` Работа с Webhook

Помимо Long Polling, вы можете получать обновления через Webhook. 
В этом случае MAX сам отправляет HTTP-запросы на ваш сервер, а вам не нужно постоянно опрашивать API.  
Данный инструмент необходимо использовать на Production стенде, 
потому что получение обновлений с помощью Long Polling ограничено по скорости и сроку хранения событий

Клиент реализует два сценария использования:

1. **Встроенный сервер** — SDK сам поднимает HTTP-сервер и регистрирует webhook в MAX.
2. **Кастомный сервер** — вы поднимаете свой HTTP-сервер (Express, Fastify, `node:http` и т.д.) и передаёте ему готовый колбэк через `bot.webhookCallback(...)`.

## Встроенный сервер

Запустить бота в режиме Webhook можно через `bot.start` с конфигом `mode: 'webhook'`:

```typescript
import { Bot } from '@maxhub/max-bot-api';

const bot = new Bot(process.env.BOT_TOKEN);

bot.on('message_created', (ctx) => ctx.reply(ctx.message.body.text));

await bot.start({
  mode: 'webhook',
  options: {
    // Внешний HTTPS-домен вашего прокси (обязательный)
    domain: 'https://my-bot.example.com',

    // Локальный порт Node.js-сервера (по умолчанию 3000)
    port: 3000,

    // Кастомный роут. Если не передать — сгенерируется
    // стабильный путь от токена бота: /webhook/<sha256(token)>
    path: '/webhook/my-secret-path',

    // Секрет для проверки входящих запросов опциональный, 
    // но настоятельно рекумендуется его передавать
    secret: 'my-secret',

    // Разрешенные типы обновлений
    allowedUpdates: ['message_created'],
  },
});
```

Что происходит при запуске:

- поднимается локальный HTTP-сервер на указанном порту;
- webhook-URL регистрируется в MAX (`api.subscribe`);
- SDK удаляет все остальные подписки, оставляя только активный webhook (`Webhook.clearSubscriptions`).

Останавливается Webhook вызовом:

```typescript
await bot.stopWebhook();
```

## Кастомный сервер

Если вам нужно встроить обработку webhook в уже существующий сервер, используйте `bot.webhookCallback(...)`.
Он возвращает колбэк сигнатуры `(req, res)`, совместимый с `node:http` и большинством фреймворков.

```typescript
import { createServer } from 'node:http';
import { Bot } from '@maxhub/max-bot-api';

const bot = new Bot(process.env.BOT_TOKEN);

bot.on('message_created', (ctx) => ctx.reply(ctx.message.body.text));

const handleUpdate = bot.webhookCallback({
  domain: 'https://my-bot.example.com',
  secret: 'my-secret',
});

const server = createServer(handleUpdate);
server.listen(3000);
```

> ⚠️ `webhookCallback` только создаёт обработчик запросов. Он **не** регистрирует webhook в MAX и **не** чистит старые подписки.
> При использовании кастомного сервера зарегистрируйте подписку вручную:
> ```typescript
> const url = Webhook.getWebhookUrl('https://my-bot.example.com', '/webhook/my-secret-path');
> await bot.api.subscribe(url, 'my-secret', ['message_created']);
> ```

Если вы хотите зарегистрировать webhook в MAX и автоматически удалить подписки, но не поднимать сервер средствами SDK, используйте `bot.createWebhook(...)`.
Он отправляет запрос на подписку (так же, как это делает `bot.start({ mode: 'webhook' })`) и возвращает готовый `(req, res)`-колбэк для вашего HTTP-сервера:

```typescript
import { createServer } from 'node:http';
import { Bot } from '@maxhub/max-bot-api';

const bot = new Bot(process.env.BOT_TOKEN);

bot.on('message_created', (ctx) => ctx.reply(ctx.message.body.text));

// Регистрируем webhook в MAX и получаем готовый (req, res)-колбэк
const handleUpdate = await bot.createWebhook({
  domain: 'https://my-bot.example.com',
  path: '/webhook/my-secret-path',
  secret: 'my-secret',
  allowedUpdates: ['message_created'],
});

const server = createServer(handleUpdate);
server.listen(3000);
```

## Полезные утилиты

`Webhook` экспортирует статические методы, которые можно вызывать без создания экземпляра класса:

```typescript
import { Webhook } from '@maxhub/max-bot-api';

// Генерация стабильного hash-пути из токена бота
const hash = Webhook.generateTokenRelatedHash(process.env.BOT_TOKEN);

// Генерация полного webhook-URL из домена и пути
const url = Webhook.getWebhookUrl('https://my-bot.example.com', `/webhook/${hash}`);
```

`Webhook.getWebhookUrl(domain, path)` принимает домен как с протоколом, так и без него:

```typescript
Webhook.getWebhookUrl('my-bot.example.com', '/webhook/abc');
// => 'https://my-bot.example.com/webhook/abc'

Webhook.getWebhookUrl('https://my-bot.example.com', '/webhook/abc');
// => 'https://my-bot.example.com/webhook/abc'
```

## Очистка подписок

Для удаления устаревших подписок можно использовать статический метод `Webhook.clearSubscriptions`:

```typescript
import { Webhook } from '@maxhub/max-bot-api';

// Удалить все подписки, кроме активного webhook-URL
await Webhook.clearSubscriptions(bot.api, activeUrl);

// Или удалить вообще все подписки
await Webhook.clearSubscriptions(bot.api);
```

## Проверка секрета

Если передан `secret`, SDK проверяет заголовок `x-max-bot-api-secret` каждого входящего запроса через `timingSafeEqual`. 
Запросы с неверным или отсутствующим секретом получают ответ `404 Not Found`.

> ⚠️ MAX требует, чтобы webhook был доступен по HTTPS и сертификаты от доверенных центров, в том числе сертификаты Минцифры. 
> Для локальной разработки используйте Long Polling или программы для работы с Api.