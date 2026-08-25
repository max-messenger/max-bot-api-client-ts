import type { Context } from '../../context';
import type { Message } from '../../network/api';
import type { MaybeArray } from '../../types';

/** Функция-триггер получает Context, а найденное совпадение попадает в `ctx.match`. */
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
      // Регулярные выражения с флагами g/y сохраняют позицию предыдущего совпадения.
      trigger.lastIndex = 0;
      return trigger.exec(value.trim());
    };
  }

  // Строковый триггер совпадает только со всей строкой и не трактуется как RegExp.
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
