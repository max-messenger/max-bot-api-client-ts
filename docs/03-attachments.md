# `3` Отправка сообщений с вложениями
Для упрощения работы с вложениями существует класс `Attachment` с функцией `toJson`, которая возвращает отформатированный объект вложения. От этого класса наследуются классы всех типов вложений.

## Отправка файлов

### При помощи токена
Подходит для файлов, которые уже были загружены в Max:
```typescript
const image = new ImageAttachment({ token: 'existingImageToken' });
await ctx.reply('', { attachments: [image.toJson()] });

const video = new VideoAttachment({ token: 'existingVideoToken' });
await ctx.reply('', { attachments: [video.toJson()] });

const audio = new AudioAttachment({ token: 'existingAudioToken' });
await ctx.reply('', { attachments: [audio.toJson()] });

const file = new FileAttachment({ token: 'existingFileToken' });
await ctx.reply('', { attachments: [file.toJson()] });
```

### Загрузка новых файлов
Вы можете загрузить файлы на сервера Max, используя методы `ctx.api`:
- `uploadImage`
- `uploadVideo`
- `uploadAudio`
- `uploadFile`

Эти методы возвращают экземпляр класса `Attachment`.

```typescript
const image = await ctx.api.uploadImage({ source: '/path/to/image' });
await ctx.reply('Это фото загружено из файла', {
  attachments: [image.toJson()],
});
```

### При помощи ссылки
Пока что доступно только для изображений:
```typescript
const image = await ctx.api.uploadImage({ url: 'https://upload.wikimedia.org/wikipedia/commons/Image.png' });
await ctx.reply('', { attachments: [image.toJson()] });
```

## Отправка других типов вложений
```typescript
const sticker = new StickerAttachment({ code: "stickerCode" });
await ctx.reply('', { attachments: [sticker.toJson()] });

const location = new LocationAttachment({ lon: 0, lat: 0 });
await ctx.reply('', { attachments: [location.toJson()] });

const share = new ShareAttachment({ url: "messagePublicUrl", token: "attachmentToken" });
await ctx.reply('', { attachments: [share.toJson()] });
```
