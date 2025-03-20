# `4` Клавиатура
Для упрощения работы с клавиатурой вы можете использовать KeyboardBuilder.

```typescript
const keyboard = Keyboard.inlineKeyboard([
  // 1-я строка с 3-мя кнопками
  [
    Keyboard.button.callback('default', 'color:default'),
    Keyboard.button.callback('positive', 'color:positive', { intent: 'positive' }),
    Keyboard.button.callback('negative', 'color:negative', { intent: 'negative' }),
  ], 
  // 2-я строка с 1-й кнопкой
  [Keyboard.button.link('Открыть Max', 'https://max.ru')],
]);
```
### Типы кнопок

#### Callback
```typescript
button.callback(text: string, payload: string, extra?: { 
  intent?: 'default' | 'positive' | 'negative' 
});
```
Добавляет callback-кнопку. При нажатии на неё сервер Max отправляет обновление `message_callback`.

#### Link
```typescript
button.link(text: string, url: string);
```
Добавляет кнопку-ссылку. При нажатии на неё пользователю будет предложено открыть ссылку в новой вкладке.

#### RequestContact
```typescript
button.requestContact(text: string);
```
Добавляет кнопку запроса контакта. При нажатии на неё боту будет отправлено сообщение с номером телефона, полным имененм и почтой пользователя во вложении в формате `VCF`.

#### RequestGeoLocation
```typescript
button.requestGeoLocation(text: string, extra?: { quick?: boolean });
```
Добавляет кнопку запроса геолокации. При нажатии на неё боту будет отправлено сообщение с геолокацией, которую укажет пользователь.

#### Chat
```typescript
button.chat(text: string, chatTitle: string, extra?: { 
  chat_description?: string | null;
  start_payload?: string | null;
  uuid?: string | null; 
});
```
Добавляет кнопку создания чата. При нажатии на неё будет создан новый чат с ботом и пользователем.
