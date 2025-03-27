# Max Bot API Client 

## Документация

В [документации](https://github.com/max-messenger/max-bot-api-client-ts/tree/master/docs) вы можете найти подробные инструкции по использованию фреймворка.

## Быстрый старт

> Если вы новичок, то можете прочитать [официальную документацию](https://dev.max.ru/), написанную разработчиками Max

### Получение токена
Откройте диалог с [PrimeBot](https://max.ru/primebot), следуйте инструкциям и создайте нового бота. После создания бота PrimeBot отправит вам токен.

### Установка
#### npm
```sh
npm install @maxhub/max-bot-api
```
#### yarn
```sh
yarn add @maxhub/max-bot-api
```
#### pnpm
```sh
pnpm add @maxhub/max-bot-api
```

### Пример
```javascript
import { Bot } from '@maxhub/max-bot-api';

const bot = new Bot(process.env.BOT_TOKEN);

// Установка подсказок с доступными командами
bot.api.setMyCommands([
  { 
    name: 'ping',
    description: 'Сыграть в пинг-понг'
  },
]);

// Обработчик события запуска бота
bot.on('bot_started', (ctx) => ctx.reply('Привет! Отправь мне команду /ping, чтобы сыграть в пинг-понг'));

// Обработчик команды '/ping'
bot.command('ping', (ctx) => ctx.reply('pong'));

// Обработчик для сообщения с текстом 'hello'
bot.hears('hello', (ctx) => ctx.reply('world'));

// Обработчик для всех остальных входящих сообщений
bot.on('message_created', (ctx) => ctx.reply(ctx.message.body.text));

bot.start();
```

### Обработка ошибок
Если во время обработки события произойдёт ошибка, Bot вызовет метод `bot.handleError`. По умолчанию `bot.handleError` просто завершает работу программы, но вы можете переопределить это поведение, используя `bot.catch`.

> ⚠️ Завершайте работу программы при неизвестных ошибках, иначе бот может зависнуть в состоянии ошибки.

> ℹ️ [`pm2`](https://pm2.keymetrics.io/) может автоматически перезапустить вашего бота, если он остановится по какой-либо причине
