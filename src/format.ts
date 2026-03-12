/**
 * Formatting helpers for the Max Bot API.
 *
 * Generates strings in Max markdown (format: 'markdown') or HTML
 * (format: 'html') notation.  Pass the result as the `text` argument and
 * add the corresponding `format` value to `SendMessageExtra`.
 *
 * @example
 * import * as fmt from './format'
 *
 * // Markdown
 * ctx.reply(fmt.bold('Hello') + ' world', { format: 'markdown' })
 *
 * // HTML
 * ctx.reply(fmt.boldHtml('Hello') + ' world', { format: 'html' })
 */

// ─── Markdown helpers ─────────────────────────────────────────────────────────

/** Wraps text in **bold** markdown. */
export const bold = (text: string): string => `**${text}**`;

/** Wraps text in _italic_ markdown. */
export const italic = (text: string): string => `_${text}_`;

/** Wraps text in ~~strikethrough~~ markdown. */
export const strikethrough = (text: string): string => `~~${text}~~`;

/** Wraps text in inline `code` markdown. */
export const code = (text: string): string => `\`${text}\``;

/**
 * Wraps text in a fenced code block markdown.
 * @param language Optional syntax-highlighting language hint.
 */
export const pre = (text: string, language = ''): string =>
  language
    ? `\`\`\`${language}\n${text}\n\`\`\``
    : `\`\`\`\n${text}\n\`\`\``;

/** Creates a markdown inline link: `[text](url)`. */
export const link = (text: string, url: string): string => `[${text}](${url})`;

/**
 * Escapes all characters that have special meaning in Max markdown.
 * Use this on user-supplied strings before embedding them into formatted text.
 */
export const escape = (text: string): string =>
  text.replace(/([_*[\]()~`>#+=|{}.!\\-])/g, '\\$1');

// ─── HTML helpers ─────────────────────────────────────────────────────────────

/** Wraps text in `<b>…</b>` HTML bold tags. */
export const boldHtml = (text: string): string => `<b>${text}</b>`;

/** Wraps text in `<i>…</i>` HTML italic tags. */
export const italicHtml = (text: string): string => `<i>${text}</i>`;

/** Wraps text in `<u>…</u>` HTML underline tags. */
export const underlineHtml = (text: string): string => `<u>${text}</u>`;

/** Wraps text in `<s>…</s>` HTML strikethrough tags. */
export const strikethroughHtml = (text: string): string => `<s>${text}</s>`;

/** Wraps text in `<code>…</code>` HTML inline code tags. */
export const codeHtml = (text: string): string => `<code>${text}</code>`;

/**
 * Wraps text in `<pre>…</pre>` HTML pre-formatted block.
 * @param language If provided, wraps content in `<code class="language-…">`.
 */
export const preHtml = (text: string, language = ''): string =>
  language
    ? `<pre><code class="language-${language}">${text}</code></pre>`
    : `<pre>${text}</pre>`;

/** Creates an HTML anchor tag: `<a href="url">text</a>`. */
export const linkHtml = (text: string, url: string): string =>
  `<a href="${url}">${text}</a>`;

/**
 * Escapes characters that must be escaped inside HTML text content.
 * Use this on user-supplied strings before embedding them into HTML-formatted text.
 */
export const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
