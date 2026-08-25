const assert = require('node:assert/strict');
const { test } = require('node:test');

const { fmt } = require('../dist');

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
