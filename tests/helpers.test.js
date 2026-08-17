const assert = require('node:assert/strict');
const { test } = require('node:test');

const { Keyboard, fmt } = require('../dist');

test('format helpers escape user-provided values', () => {
  assert.equal(fmt.escapeHtml('<Tom & Jerry>'), '&lt;Tom &amp; Jerry&gt;');
  assert.equal(fmt.bold(fmt.escape('a*b')), '**a\\*b**');
  assert.equal(
    fmt.linkHtml('site', 'https://example.test/" onclick="alert(1)'),
    '<a href="https://example.test/&quot; onclick=&quot;alert(1)">site</a>',
  );
});

test('inline keyboard supports columns and hidden buttons', () => {
  const keyboard = Keyboard.inlineKeyboard([
    Keyboard.button.callback('One', '1'),
    { ...Keyboard.button.callback('Hidden', 'hidden'), hide: true },
    Keyboard.button.callback('Two', '2'),
    Keyboard.button.callback('Three', '3'),
  ], { columns: 2 });

  assert.deepEqual(keyboard.payload.buttons.map((row) => row.length), [2, 1]);
  assert.equal(keyboard.payload.buttons.flat().some((button) => 'hide' in button), false);
  assert.deepEqual(
    keyboard.payload.buttons.flat().map((button) => button.text),
    ['One', 'Two', 'Three'],
  );
});

test('inline keyboard validates columns', () => {
  assert.throws(
    () => Keyboard.inlineKeyboard([Keyboard.button.callback('One', '1')], { columns: 0 }),
    /positive integer/,
  );
});

test('flat keyboard defaults to one button per row and supports custom wrap', () => {
  const buttons = [
    Keyboard.button.callback('One', '1'),
    Keyboard.button.callback('Two', '2'),
    Keyboard.button.callback('Three', '3'),
  ];

  const defaultLayout = Keyboard.inlineKeyboard(buttons);
  assert.deepEqual(defaultLayout.payload.buttons.map((row) => row.length), [1, 1, 1]);

  const wrapped = Keyboard.inlineKeyboard(buttons, {
    wrap: (_button, index) => index === 2,
  });
  assert.deepEqual(wrapped.payload.buttons.map((row) => row.length), [2, 1]);
});
