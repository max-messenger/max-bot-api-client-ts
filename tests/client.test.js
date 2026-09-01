const assert = require('node:assert/strict');
const { test } = require('node:test');

const { Bot } = require('../dist');
const { createClient } = require('../dist/core/network/api');

test('createClient uses custom fetch from client options', async () => {
  const calls = [];
  const customFetch = async (...args) => {
    calls.push(args);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'content-type': 'application/json' },
      status: 200,
    });
  };

  const client = createClient('token', {
    baseUrl: 'https://example.test/api/',
    fetch: customFetch,
  });

  const result = await client.call({
    method: 'me',
    options: {
      method: 'GET',
      query: { active: true, empty: null },
    },
  });

  assert.deepEqual(result, { status: 200, data: { ok: true } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'https://example.test/api/me?active=true');
  assert.equal(calls[0][1].method, 'GET');
  assert.equal(calls[0][1].headers.Authorization, 'token');
});

test('Bot passes custom fetch from client options to API calls', async () => {
  const calls = [];
  const customFetch = async (...args) => {
    calls.push(args);
    return new Response(JSON.stringify({ user_id: 1, username: 'proxy_bot', first_name: 'Proxy' }), {
      headers: { 'content-type': 'application/json' },
      status: 200,
    });
  };

  const bot = new Bot('token', {
    clientOptions: {
      baseUrl: 'https://example.test/api/',
      fetch: customFetch,
    },
  });

  const info = await bot.api.getMyInfo();

  assert.equal(info.username, 'proxy_bot');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'https://example.test/api/me');
});
