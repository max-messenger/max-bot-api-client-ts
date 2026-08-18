import type { MaybeArray } from '../core/types';
import type { Message } from '../core/network/api';
import type { Context } from './context';

/**
 * A context-aware trigger. Returning `null` means "no match"; a match is stored
 * on `ctx.match` before the selected middleware starts.
 */
export type TriggerFn<Ctx extends Context> = (
  value: string,
  ctx: Ctx,
) => RegExpExecArray | null;

export type Triggers<Ctx extends Context = Context> =
MaybeArray<string | RegExp | TriggerFn<Ctx>>;

export const normalizeTriggers = <Ctx extends Context>(triggers: Triggers<Ctx>) => {
  return (Array.isArray(triggers) ? triggers : [triggers]).map((trigger) => {
    if (typeof trigger === 'function') return trigger;
    if (trigger instanceof RegExp) {
      return (value: string = '') => {
        // Global/sticky RegExp instances retain lastIndex between executions.
        // Reset it so the same trigger behaves identically for every update.
        // eslint-disable-next-line no-param-reassign
        trigger.lastIndex = 0;
        return trigger.exec(value.trim());
      };
    }
    // Strings are exact values, not regular-expression source. This also makes
    // trigger text such as "a.b" match the dot literally.
    const regex = new RegExp(`^${escapeRegExp(trigger)}$`);
    return (value: string) => regex.exec(value.trim());
  });
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const extractTextFromMessage = (message: Message, myId?: number) => {
  const { text } = message.body;
  const mention = message.body.markup?.find((markup) => markup.type === 'user_mention');

  if (mention && mention.from === 0 && mention.user_id === myId) {
    // In group chats MAX may prefix a command with a mention of the bot. Strip
    // only a leading mention addressed to this bot, preserving other mentions.
    return text?.slice(mention.length).trim();
  }

  return text;
};
