import type {
  MessageBody, MessageCreatedUpdate, Update,
} from './core/network/api';

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
