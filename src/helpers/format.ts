/**
 * Форматирование Markdown и HTML для сообщений MAX. Обёртки не экранируют
 * аргументы: пользовательский текст нужно явно передать в escape/escapeHtml.
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

/** Экранирует пользовательский текст перед вставкой в Markdown. */
export const escape = (text: string): string => {
  // Экранируем все управляющие символы, не пытаясь определить окружающий контекст.
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

/** Экранирует пользовательский текст перед вставкой в HTML. */
export const escapeHtml = (text: string): string => {
  // Амперсанд заменяется первым, чтобы новые HTML-последовательности не экранировались повторно.
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};
