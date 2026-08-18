const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  ConversationEngine,
  MemorySessionStore,
  defineConversation,
  session,
  transition,
} = require('../dist');

const noop = () => Promise.resolve();

const createRuntime = (options = {}) => {
  const store = new MemorySessionStore();
  const sessions = session({
    store,
    getSessionKey: (ctx) => ctx.key,
    defaultSession: () => ({}),
  });
  const conversations = new ConversationEngine(options);
  const run = (ctx, next = noop) => {
    return sessions(ctx, () => conversations.middleware()(ctx, next));
  };
  return { conversations, run, store };
};

test('conversation uses named steps stored in session', async () => {
  const events = [];
  const registration = defineConversation()({
    id: 'registration',
    initialStep: 'ask-name',
    createData: () => ({ name: '' }),
    steps: {
      'ask-name': ({ ctx }) => {
        events.push('ask-name');
        ctx.prompt = 'name';
        return transition.goto('read-name');
      },
      'read-name': ({ ctx }) => {
        // Business work happens before complete; a failure keeps this step active.
        events.push(`save:${ctx.text}`);
        return transition.complete();
      },
    },
  });
  const { conversations, run, store } = createRuntime();
  conversations.register(registration);

  const first = { key: 'user' };
  await run(first, () => first.conversation.start(registration));
  assert.equal(first.prompt, 'name');
  assert.equal(store.get('user').conversation.step, 'read-name');

  await run({ key: 'user', text: 'Иван' });
  assert.equal(store.get('user').conversation, undefined);
  assert.deepEqual(events, ['ask-name', 'save:Иван']);
});

test('stay persists a data patch without changing the named step', async () => {
  const flow = defineConversation()({
    id: 'attempts',
    initialStep: 'validate',
    createData: () => ({ attempts: 0 }),
    steps: {
      validate: ({ data }) => transition.stay({ attempts: data.attempts + 1 }),
    },
  });
  const { conversations, run, store } = createRuntime();
  conversations.register(flow);

  const ctx = { key: 'user' };
  await run(ctx, () => ctx.conversation.start(flow));
  assert.deepEqual(store.get('user').conversation, {
    id: 'attempts', step: 'validate', data: { attempts: 1 }, expiresAt: undefined,
  });
});

test('failed final step leaves conversation available for retry', async () => {
  let saves = 0;
  const flow = defineConversation()({
    id: 'reliable',
    initialStep: 'prepare',
    createData: () => ({ orderId: 'order-1' }),
    steps: {
      prepare: () => transition.goto('save'),
      save: ({ ctx }) => {
        saves += 1;
        if (ctx.fail) throw new Error('database unavailable');
        return transition.complete();
      },
    },
  });
  const { conversations, run, store } = createRuntime();
  conversations.register(flow);

  const first = { key: 'user' };
  await run(first, () => first.conversation.start(flow));
  await assert.rejects(() => run({ key: 'user', fail: true }), /database unavailable/);
  assert.equal(store.get('user').conversation.step, 'save');

  await run({ key: 'user', fail: false });
  assert.equal(store.get('user').conversation, undefined);
  assert.equal(saves, 2);
});

test('another definition with the same id is rejected before state is written', async () => {
  const original = defineConversation()({
    id: 'duplicate', initialStep: 'one', createData: () => ({}),
    steps: { one: () => transition.stay() },
  });
  const replacement = defineConversation()({
    id: 'duplicate', initialStep: 'two', createData: () => ({}),
    steps: { two: () => transition.stay() },
  });
  const { conversations, run, store } = createRuntime();
  conversations.register(original);
  const ctx = { key: 'user' };

  await assert.rejects(
    () => run(ctx, () => ctx.conversation.start(replacement)),
    /another definition/,
  );
  assert.equal(store.get('user').conversation, undefined);
});

test('expired conversation is removed and does not consume the update', async () => {
  let now = 100;
  let downstream = false;
  const flow = defineConversation()({
    id: 'short', initialStep: 'wait', idleTimeoutMs: 10, createData: () => ({}),
    steps: { wait: () => transition.stay() },
  });
  const { conversations, run, store } = createRuntime({ now: () => now });
  conversations.register(flow);
  const first = { key: 'user' };
  await run(first, () => first.conversation.start(flow));

  now = 111;
  await run({ key: 'user' }, async () => { downstream = true; });
  assert.equal(downstream, true);
  assert.equal(store.get('user').conversation, undefined);
});

test('interceptor handles cancellation before the current step', async () => {
  let calls = 0;
  const flow = defineConversation()({
    id: 'cancellable', initialStep: 'wait', createData: () => ({}),
    intercept: ({ ctx }) => ctx.cancel ? transition.cancel() : undefined,
    steps: {
      wait: () => { calls += 1; return transition.stay(); },
    },
  });
  const { conversations, run, store } = createRuntime();
  conversations.register(flow);
  const first = { key: 'user' };
  await run(first, () => first.conversation.start(flow));
  await run({ key: 'user', cancel: true });

  assert.equal(calls, 1);
  assert.equal(store.get('user').conversation, undefined);
});

test('split middleware lets global commands run before conversation interception', async () => {
  let stepCalls = 0;
  const flow = defineConversation()({
    id: 'global-command', initialStep: 'prepare', createData: () => ({}),
    steps: {
      prepare: () => transition.goto('wait'),
      wait: () => { stepCalls += 1; return transition.stay(); },
    },
  });
  const store = new MemorySessionStore();
  const sessions = session({
    store,
    getSessionKey: (ctx) => ctx.key,
    defaultSession: () => ({}),
  });
  const conversations = new ConversationEngine();
  conversations.register(flow);

  const run = (ctx, globalMiddleware) => sessions(ctx, () => {
    return conversations.controllerMiddleware()(ctx, () => {
      return globalMiddleware(ctx, () => conversations.interceptMiddleware()(ctx, noop));
    });
  });

  const first = { key: 'user' };
  await run(first, (ctx) => ctx.conversation.start(flow));
  assert.equal(store.get('user').conversation.step, 'wait');

  const cancel = { key: 'user', command: 'cancel' };
  await run(cancel, async (ctx, next) => {
    assert.equal(ctx.conversation.current, 'global-command');
    if (ctx.command !== 'cancel') return next();
    assert.equal(ctx.conversation.cancel(), true);
    return undefined;
  });

  assert.equal(stepCalls, 0);
  assert.equal(store.get('user').conversation, undefined);
  assert.equal(cancel.conversation.active, false);
  assert.equal(cancel.conversation.current, undefined);
  assert.equal(cancel.conversation.cancel(), false);
});

test('session serialization protects concurrent conversation updates locally', async () => {
  const delay = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
  const flow = defineConversation()({
    id: 'counter', initialStep: 'prepare', createData: () => ({ count: 0 }),
    steps: {
      prepare: () => transition.goto('increment'),
      increment: async ({ ctx, data }) => {
        const count = data.count;
        await delay(ctx.wait);
        return transition.stay({ count: count + 1 });
      },
    },
  });
  const { conversations, run, store } = createRuntime();
  conversations.register(flow);
  const first = { key: 'user' };
  await run(first, () => first.conversation.start(flow));

  await Promise.all([
    run({ key: 'user', wait: 10 }),
    run({ key: 'user', wait: 0 }),
  ]);
  assert.equal(store.get('user').conversation.data.count, 2);
});

test('definition validation rejects unknown initial steps', () => {
  const invalid = defineConversation()({
    id: 'invalid', initialStep: 'missing',
    steps: { actual: () => transition.complete() },
  });
  assert.throws(() => new ConversationEngine().register(invalid), /no initial step/);
});

test('definition validation does not accept inherited step names', () => {
  const invalid = defineConversation()({
    id: 'inherited', initialStep: 'toString', steps: {},
  });
  assert.throws(() => new ConversationEngine().register(invalid), /no initial step/);
});
