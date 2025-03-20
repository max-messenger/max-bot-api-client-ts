# `2` Прослушивание обновлений и реакция на них

После запуска бота Max начнёт отправлять вам обновления.
> Подробности обо всех обновлениях смотрите в [официальной документации](https://dev.max.ru/).

Max Bot API позволяет прослушивать эти обновления, например:
```typescript
// Обработчик начала диалога с ботом
bot.on('bot_started', (ctx) => {/* ... */});

// Обработчик новых сообщений
bot.on('message_created', (ctx) => {/* ... */});

// Обработчик добавления пользователя в беседу
bot.on('user_added', (ctx) => {/* ... */});
```
Вы можете использовать подсказки в редакторе кода, чтобы увидеть все доступные типы обновлений.

## Получение сообщений
Вы можете подписаться на обновление `message_created`:
```typescript
bot.on('message_created', (ctx) => {
  const message = ctx.message; // полученное сообщение
});
```
Или воспользоваться специальными методами:
```typescript
// Обработчик команды '/start'
bot.command('start', async (ctx) => {/* ... */});

// Сравнение текста сообщения со строкой или регулярным выраженим
bot.hears('hello', async (ctx) => {/* ... */});
bot.hears(/echo (.+)?/, async (ctx) => {/* ... */});

// Обработчик нажатия на callback-кнопку с указанным payload
bot.action('connect_wallet', async (ctx) => {/* ... */});
bot.action(/color:(.+)/, async (ctx) => {/* ... */});
```

## Отправка сообщений
Вы можете воспользоваться методами из `bot.api`:
```typescript
// Отправить сообщение пользователю с id=12345
await bot.api.sendMessageToUser(12345, "Привет!");
// Опционально вы можете передать дополнительные параметры
await bot.api.sendMessageToUser(12345, "Привет!", {/* доп. параметры */});

// Отправить сообщение в чат с id=54321
await bot.api.sendMessageToChat(54321, "Всем привет!");

// Получить отправленное сообщения
const message = await bot.api.sendMessageToUser(12345, "Привет!");
console.log(message.body.mid);
```
> ℹ️ Если Max Bot API ещё не поддерживает какой-то метод, то вы можете вызвать его через `ctx.api.raw`
> 
> Методы raw api имеют следующуй формат:
> ```typescript
> ctx.api.raw.get('method', {/* параметры запроса */});
> ctx.api.raw.post('method', {/* параметры запроса */});
> ctx.api.raw.put('method', {/* параметры запроса */});
> ctx.api.raw.patch('method', {/* параметры запроса */});
> ctx.api.raw.delete('method', {/* параметры запроса */});
> 
> // Вызов метода редактирования чата с id=123
> await ctx.api.raw.patch('chats/{chat_id}', {
>   path: { chat_id: 123 }, // параметры ссылки
>   body: { title: 'New Title' }, // тело запроса
>   query: { notify: false }, // параметры поиска
> });
> ```

Или воспользоваться методом контекста `reply`:
```typescript
bot.hears('ping', async (ctx) => {
  // 'reply' — псевдоним метода 'ctx.api.sendMessageToChat' в этом же чате
  await ctx.reply('pong', {
    // 'link' прикрепляет оригинальное сообщение
    link: { type: 'reply', mid: ctx.message.body.mid },
  });
});
```

## Форматирование сообщений
> Подробности про форматирование смотрите в [официальной документации](https://dev.max.ru/).

Вы можете отправлять сообщения, используя **жирный** или _курсивный_ текст, ссылки и многое другое. Есть два типа форматирования: `markdown` и `html`.
#### Markdown
```typescript
await bot.api.sendMessageToChat(
  12345,
  '**Привет!** _Добро пожаловать_ в [Max](https://dev.max.ru).',
  { format: 'markdown' },
);
```
#### HTML
```typescript
await bot.api.sendMessageToChat(
  12345,
  '<b>Привет!</b> <i>Добро пожаловать</i> в <a href="https://dev.max.ru">Max</a>.',
  { format: 'html' },
);
```
