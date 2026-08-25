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

test('markdown helpers produce expected markup', () => {
  assert.equal(fmt.bold('text'), '**text**');
  assert.equal(fmt.italic('text'), '_text_');
  assert.equal(fmt.strikethrough('text'), '~~text~~');
  assert.equal(fmt.code('const value = 1'), '`const value = 1`');
  assert.equal(fmt.pre('const value = 1', 'ts'), '```ts\nconst value = 1\n```');
  assert.equal(fmt.link('MAX', 'https://dev.max.ru'), '[MAX](https://dev.max.ru)');
  assert.equal(fmt.escape('a_b [c].'), 'a\\_b \\[c\\]\\.');
});

test('html helpers produce expected markup and escape unsafe values', () => {
  assert.equal(fmt.boldHtml('text'), '<b>text</b>');
  assert.equal(fmt.italicHtml('text'), '<i>text</i>');
  assert.equal(fmt.underlineHtml('text'), '<u>text</u>');
  assert.equal(fmt.strikethroughHtml('text'), '<s>text</s>');
  assert.equal(fmt.codeHtml('const value = 1'), '<code>const value = 1</code>');
  assert.equal(
    fmt.preHtml('const value = 1', 'ts'),
    '<pre><code class="language-ts">const value = 1</code></pre>',
  );
  assert.equal(
    fmt.boldHtml(fmt.escapeHtml('<script>alert("x")</script>')),
    '<b>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</b>',
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
