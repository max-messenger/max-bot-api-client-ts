const assert = require('node:assert/strict');
const { test } = require('node:test');

const { MemorySessionStore, session } = require('../dist');

const delay = (timeout) => new Promise((resolve) => { setTimeout(resolve, timeout); });

test('session persists state between updates', async () => {
  const store = new MemorySessionStore();
  const middleware = session({
    store,
    getSessionKey: (ctx) => ctx.key,
    defaultSession: () => ({ count: 0 }),
  });
  const first = { key: 'user' };
  await middleware(first, async () => { first.session.count += 1; });
  const second = { key: 'user' };
  await middleware(second, async () => { second.session.count += 1; });

  assert.equal(store.get('user').count, 2);
});

test('session serializes concurrent updates with the same key', async () => {
  const store = new MemorySessionStore();
  const middleware = session({
    store,
    getSessionKey: () => 'same-user',
    defaultSession: () => ({ count: 0 }),
  });
  const update = (wait) => {
    const ctx = {};
    return middleware(ctx, async () => {
      const count = ctx.session.count;
      await delay(wait);
      ctx.session.count = count + 1;
    });
  };

  await Promise.all([update(10), update(0)]);
  assert.equal(store.get('same-user').count, 2);
});

test('session supports a custom context property', async () => {
  const store = new MemorySessionStore();
  const middleware = session({
    property: 'stateData',
    store,
    getSessionKey: () => 'user',
    defaultSession: () => ({ enabled: false }),
  });
  const ctx = {};

  await middleware(ctx, async () => { ctx.stateData.enabled = true; });
  assert.deepEqual(store.get('user'), { enabled: true });
});

test('session rejects properties that can modify the context prototype', () => {
  assert.throws(() => session({ property: '__proto__' }), /Unsafe session property/);
});

test('assigning a nullish value deletes a session', async () => {
  const store = new MemorySessionStore();
  const middleware = session({ store, getSessionKey: () => 'user' });

  for (const value of [undefined, null]) {
    store.set('user', { active: true });
    const ctx = {};
    await middleware(ctx, async () => { ctx.session = value; });
    assert.equal(store.get('user'), undefined);
  }
});

test('a null chat id does not produce a literal null session key', async () => {
  const store = new MemorySessionStore();
  store.set('7:null', { leaked: true });
  const middleware = session({ store });
  const ctx = { user: { user_id: 7 }, chatId: null };

  await middleware(ctx, async () => {
    assert.equal(ctx.session, undefined);
  });
  assert.deepEqual(store.get('7:null'), { leaked: true });
});

test('session changes made before a downstream error are persisted', async () => {
  const store = new MemorySessionStore();
  const middleware = session({
    store, getSessionKey: () => 'user', defaultSession: () => ({ count: 0 }),
  });
  const ctx = {};

  await assert.rejects(() => middleware(ctx, async () => {
    ctx.session.count = 1;
    throw new Error('handler failed');
  }), /handler failed/);
  assert.equal(store.get('user').count, 1);
});

test('memory store expires entries after ttl', async () => {
  const store = new MemorySessionStore(1);
  store.set('short', { value: true });
  await delay(5);
  assert.equal(store.get('short'), undefined);
});
