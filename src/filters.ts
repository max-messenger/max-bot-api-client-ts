import type {
  MessageBody, MessageCallbackUpdate, MessageCreatedUpdate,
  MessageEditedUpdate, Update,
} from './core/network/api';

import type { Guard } from './core/helpers/types';

export const createdMessageBodyHas = <Keys extends Array<keyof MessageBody>>(...keys: Keys) => {
  return (update: Update): update is MessageCreatedUpdate => {
    if (update.update_type !== 'message_created') return false;
    for (const key of keys) {
      if (!(key in update.message.body)) return false;
      if (update.message.body[key] === undefined) return false;
    }
    return true;
  };
};

/** Matches `message_edited` updates. */
export const messageEdited = (update: Update): update is MessageEditedUpdate =>
  update.update_type === 'message_edited';

/** Matches `message_callback` updates. */
export const messageCallback = (update: Update): update is MessageCallbackUpdate =>
  update.update_type === 'message_callback';

/**
 * Logical OR — passes the update if at least one filter matches.
 *
 * @example
 * bot.on(anyOf('message_created', 'message_edited'), handler)
 */
export const anyOf = <U extends Update>(
  ...filters: Array<Guard<Update, U> | Update['update_type']>
): Guard<Update, U> =>
  (update): update is U =>
    filters.some((f) =>
      typeof f === 'function' ? f(update) : update.update_type === f,
    );

/**
 * Logical AND — passes the update only when all filters match.
 *
 * @example
 * bot.on(allOf(messageEdited, createdMessageBodyHas('text')), handler)
 */
export const allOf = <U extends Update>(
  ...filters: Array<Guard<Update, U> | Update['update_type']>
): Guard<Update, U> =>
  (update): update is U =>
    filters.every((f) =>
      typeof f === 'function' ? f(update) : update.update_type === f,
    );
