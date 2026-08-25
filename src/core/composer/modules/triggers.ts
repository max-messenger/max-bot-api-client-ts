import type { MaybeArray } from '../../types';
import type { Message } from '../../network/api';
import type { Context } from '../../context';

/** Триггер с доступом к Context; найденное совпадение сохраняется в `ctx.match`. */
export type TriggerFn<Ctx extends Context> = (
  value: string,
  ctx: Ctx,
) => RegExpExecArray | null;

export type Triggers<Ctx extends Context = Context> =
MaybeArray<string | RegExp | TriggerFn<Ctx>>;

const normalizeTrigger = <Ctx extends Context>(
  trigger: string | RegExp | TriggerFn<Ctx>,
): TriggerFn<Ctx> => {
  if (typeof trigger === 'function') return trigger;
  if (trigger instanceof RegExp) {
    return (value: string = '') => {
      // RegExp с флагами g/y сохраняет lastIndex, поэтому сбрасываем его перед проверкой.
      // eslint-disable-next-line no-param-reassign
      trigger.lastIndex = 0;
      return trigger.exec(value.trim());
    };
  }

  // Строка означает точное значение, а не исходный код регулярного выражения.
  const regex = new RegExp(`^${escapeRegExp(trigger)}$`);
  return (value: string) => regex.exec(value.trim());
};

export const normalizeTriggers = <Ctx extends Context>(triggers: Triggers<Ctx>) => {
  return Array.isArray(triggers)
    ? triggers.map((trigger) => normalizeTrigger<Ctx>(trigger))
    : [normalizeTrigger<Ctx>(triggers)];
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const extractTextFromMessage = (message: Message, myId?: number) => {
  const { text } = message.body;
  const mention = message.body.markup?.find((markup) => markup.type === 'user_mention');

  if (mention && mention.from === 0 && mention.user_id === myId) {
    // В групповом чате убираем только начальное упоминание текущего бота.
    return text?.slice(mention.length).trim();
  }

  return text;
};
