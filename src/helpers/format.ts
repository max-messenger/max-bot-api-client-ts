/**
 * Markdown and HTML formatting helpers for MAX messages. Wrappers intentionally
 * do not escape their arguments: trusted markup may be composed freely, while
 * user-provided values must be passed through escape/escapeHtml explicitly.
 */

export const bold = (text: string): string => `**${text}**`;

export const italic = (text: string): string => `_${text}_`;

export const strikethrough = (text: string): string => `~~${text}~~`;

export const code = (text: string): string => `\`${text}\``;

export const pre = (text: string, language = ''): string => {
  return language
    ? `\`\`\`${language}\n${text}\n\`\`\``
    : `\`\`\`\n${text}\n\`\`\``;
};

export const link = (text: string, url: string): string => `[${text}](${url})`;

/** Escapes user-provided text before embedding it into Markdown. */
export const escape = (text: string): string => {
  // Escape every character with formatting meaning rather than attempting to
  // infer the surrounding Markdown context.
  return text.replace(/([_*[\]()~`>#+=|{}.!\\-])/g, '\\$1');
};

export const boldHtml = (text: string): string => `<b>${text}</b>`;

export const italicHtml = (text: string): string => `<i>${text}</i>`;

export const underlineHtml = (text: string): string => `<u>${text}</u>`;

export const strikethroughHtml = (text: string): string => `<s>${text}</s>`;

export const codeHtml = (text: string): string => `<code>${text}</code>`;

export const preHtml = (text: string, language = ''): string => {
  return language
    ? `<pre><code class="language-${language}">${text}</code></pre>`
    : `<pre>${text}</pre>`;
};

export const linkHtml = (text: string, url: string): string => {
  return `<a href="${escapeHtml(url)}">${text}</a>`;
};

/** Escapes user-provided text before embedding it into HTML. */
export const escapeHtml = (text: string): string => {
  // Ampersand must be replaced first so entities added below are not escaped a
  // second time.
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};
