import { Bot, ImageAttachment, StickerAttachment, LocationAttachment } from '@maxhub/max-bot-api';

import fs from 'fs';
import path from 'path';

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('Token not provided');

const bot = new Bot(token);

bot.api.setMyCommands([
  { name: 'local', description: 'Send local video' },
  { name: 'url', description: 'Send image from url' },
  { name: 'stream', description: 'Send audio from stream' },
  { name: 'buffer', description: 'Send file form buffer' },
  { name: 'album', description: 'Send photo album' },
  { name: 'sticker', description: 'Send sticker' },
  { name: 'location', description: 'Send random location' },
]);

const FILES_PATH = path.resolve(__dirname, '../public');

const IMAGE_URL = 'https://uploads.dailydot.com/2024/06/crying-cat-thumb.jpg?q=65&auto=format&w=1600&ar=2:1&fit=crop';
const IMAGE_TOKEN = 'itEotJMWhvImH7s2DSAEMGcG5/uVJkPGQRMUVEYj6JyfxIlJUOqSVjaQD4QxaM6gU60zDWcxct4a9ZyjUW2PPZNgMGwSuAM5ykMjndfWhqEoG+aC4El7dEaEm339G0cSE3yA8BipJQSqJli2az63W0PhHyh1cW1bXS5QVl0t85k=';

const STICKER_CODE = 'db4ff394c4';

bot.command('local', async (ctx) => {
  const video = await ctx.api.uploadVideo({
    source: `${FILES_PATH}/video.mp4`,
  });
  return ctx.reply('', { attachments: [video.toJson()] });
});

bot.command('url', async (ctx) => {
  const image = await ctx.api.uploadImage({ url: IMAGE_URL });
  return ctx.reply('', { attachments: [image.toJson()] });
});

bot.command('stream', async (ctx) => {
  const audio = await ctx.api.uploadAudio({
    source: fs.createReadStream(`${FILES_PATH}/audio.mp3`),
  });
  return ctx.reply('', { attachments: [audio.toJson()] });
});

bot.command('buffer', async (ctx) => {
  const image = await ctx.api.uploadFile({
    source: fs.readFileSync(`${FILES_PATH}/image.png`),
  });
  return ctx.reply('', { attachments: [image.toJson()] });
});

bot.command('album', async (ctx) => {
  return ctx.reply('', {
    attachments: [
      (await ctx.api.uploadImage({ url: IMAGE_URL })).toJson(),
      (await ctx.api.uploadImage({
        source: fs.readFileSync(`${FILES_PATH}/image.png`),
      })).toJson(),
      new ImageAttachment({ token: IMAGE_TOKEN }).toJson(),
    ],
  });
});

bot.command('sticker', (ctx) => {
  return ctx.reply('', {
    attachments: [new StickerAttachment({ code: STICKER_CODE }).toJson()],
  });
});

bot.command('location', (ctx) => {
  const lat = getRandomInRange(-180, 180, 3);
  const lon = getRandomInRange(-180, 180, 3);
  return ctx.reply(`${lat}, ${lon}`, {
    attachments: [new LocationAttachment({ lat, lon }).toJson()],
  });
});

void bot.start();

const getRandomInRange = (from: number, to: number, fixed = 0) => {
  return Number((Math.random() * (to - from) + from).toFixed(fixed));
};
