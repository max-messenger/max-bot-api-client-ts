# `5` Расширение контекста

Вы можете расширить контекст, который приходит при каждом обновлении:
```typescript
interface MyContext extends Context {
  isAdmin?: boolean;
}

const ADMIN_ID = 12345;

const bot = new Bot<MyContext>(process.env.BOT_TOKEN);

bot.use(async (ctx, next) => {
  ctx.isAdmin = ctx.user?.user_id === ADMIN_ID;
  return next();
});

bot.command('start', async (ctx) => {
  if (ctx.isAdmin) {
    return ctx.reply('Привет, админ!');
  }
  return ctx.reply('Привет!');
});
```
