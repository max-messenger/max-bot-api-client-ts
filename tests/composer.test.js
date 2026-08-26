const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  Composer, Context, allOf, anyOf,
  messageCallback, messageEdited,
} = require('../dist');

const noop = () => Promise.resolve();

const messageContext = (text) => new Context({
  update_type: 'message_created',
  timestamp: 1,
  message: {
    body: { mid: 'mid', text },
    recipient: { chat_id: 10 },
    sender: { user_id: 20 },
  },
}, {});

test('hears treats string triggers as exact strings', async () => {
  const composer = new Composer();
  let calls = 0;
  composer.hears('a.b', () => { calls += 1; });

  await composer.middleware()(messageContext('axb'), noop);
  await composer.middleware()(messageContext('a.b'), noop);

  assert.equal(calls, 1);
});

test('command only matches text that starts with a slash', async () => {
  const composer = new Composer();
  let calls = 0;
  composer.command('ping', () => { calls += 1; });

  await composer.middleware()(messageContext('ping'), noop);
  await composer.middleware()(messageContext('/ping'), noop);

  assert.equal(calls, 1);
});

test('context-aware trigger receives the current context', async () => {
  const composer = new Composer();
  const ctx = messageContext('hello');
  let received;
  composer.hears((value, current) => {
    received = current;
    return /^hello$/.exec(value);
  }, () => undefined);

  await composer.middleware()(ctx, noop);
  assert.equal(received, ctx);
});

test('tap runs before the remaining chain and fork runs in parallel', async () => {
  const events = [];
  const tapped = Composer.tap(async () => { events.push('tap'); });
  await tapped({}, async () => { events.push('next'); });
  assert.deepEqual(events, ['tap', 'next']);

  let forkDone = false;
  const forked = Composer.fork(async () => {
    await new Promise((resolve) => { setTimeout(resolve, 5); });
    forkDone = true;
  });
  await forked({}, noop);
  assert.equal(forkDone, true);
});

test('composer supports async branching, dispatch and error boundaries', async () => {
  const events = [];
  const branch = Composer.branch(
    async () => true,
    () => { events.push('yes'); },
    () => { events.push('no'); },
  );
  const dispatch = Composer.dispatch(
    async () => 'known',
    { known: () => { events.push('dispatched'); } },
  );
  const caught = Composer.catch(
    (error) => { events.push(error.message); },
    () => { throw new Error('caught'); },
  );

  await Composer.compose([branch, dispatch, caught])({}, noop);
  assert.deepEqual(events, ['yes']);

  await dispatch({}, noop);
  await caught({}, noop);
  assert.deepEqual(events, ['yes', 'dispatched', 'caught']);
});

test('dispatch uses an explicit fallback for missing routes', async () => {
  const events = [];
  const dispatch = Composer.dispatch(
    async () => undefined,
    { known: () => { events.push('known'); } },
    () => { events.push('fallback'); },
  );

  await dispatch({}, noop);
  assert.deepEqual(events, ['fallback']);
});

test('dispatch applies a route state patch before the selected handler', async () => {
  const ctx = { state: {} };
  const dispatch = Composer.dispatch(
    () => ({ route: 'known', state: { accountId: 42 } }),
    {
      known: (current) => {
        assert.equal(current.state.accountId, 42);
      },
    },
  );

  await dispatch(ctx, noop);
});

test('dispatch ignores inherited routes and rejects prototype state keys', async () => {
  let fallback = false;
  await Composer.dispatch(
    () => 'toString',
    {},
    () => { fallback = true; },
  )({ state: {} }, noop);
  assert.equal(fallback, true);

  const unsafe = JSON.parse('{"__proto__":{"polluted":true}}');
  const dispatch = Composer.dispatch(
    () => ({ route: 'known', state: unsafe }),
    { known: () => undefined },
  );
  await assert.rejects(() => dispatch({ state: {} }, noop), /Unsafe context state key/);
  assert.equal({}.polluted, undefined);
});

test('filter combinators support update names and guards', () => {
  const edited = { update_type: 'message_edited', timestamp: 1, message: {} };
  assert.equal(anyOf(messageCallback, messageEdited)(edited), true);
  assert.equal(allOf('message_edited', messageEdited)(edited), true);
  assert.equal(allOf('message_created', messageEdited)(edited), false);
});
