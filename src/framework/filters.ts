import type {
  MessageBody, MessageCallbackUpdate, MessageCreatedUpdate,
  MessageEditedUpdate, FilteredUpdate, Update, UpdateType,
} from '../core/network/api';
import type { Guard } from '../core/types';

type UpdateFilter = UpdateType | Guard<Update>;

/** Extracts the narrowed update type represented by a name or a type guard. */
type FilteredBy<Filter> = Filter extends UpdateType
  ? FilteredUpdate<Filter>
  : Filter extends Guard<Update, infer U>
    ? U
    : never;

type UnionToIntersection<Union> = (
  Union extends unknown ? (value: Union) => void : never
) extends (value: infer Intersection) => void ? Intersection : never;

const matches = (filter: UpdateFilter, update: Update) => {
  // Keep one runtime implementation for both combinators so their only
  // difference is the `some`/`every` boolean operation.
  return typeof filter === 'function'
    ? filter(update)
    : update.update_type === filter;
};

export const createdMessageBodyHas = <Keys extends Array<keyof MessageBody>>(...keys: Keys) => {
  return (update: Update): update is MessageCreatedUpdate => {
    // Checking both ownership and value avoids treating an explicitly
    // undefined optional field as present.
    if (update.update_type !== 'message_created') return false;
    for (const key of keys) {
      if (!(key in update.message.body)) return false;
      if (update.message.body[key] === undefined) return false;
    }
    return true;
  };
};

export const messageEdited = (update: Update): update is MessageEditedUpdate => {
  return update.update_type === 'message_edited';
};

export const messageCallback = (update: Update): update is MessageCallbackUpdate => {
  return update.update_type === 'message_callback';
};

/**
 * Creates a guard that matches when at least one filter matches. The resulting
 * type is a union because the update may satisfy any one of the filters.
 */
export const anyOf = <Filters extends UpdateFilter[]>(...filters: Filters): Guard<
Update,
FilteredBy<Filters[number]>
> => {
  return (update): update is FilteredBy<Filters[number]> => {
    return filters.some((filter) => matches(filter, update));
  };
};

/**
 * Creates a guard that matches only when every filter matches. The resulting
 * type is an intersection because all guard guarantees hold simultaneously.
 */
export const allOf = <Filters extends UpdateFilter[]>(...filters: Filters): Guard<
Update,
UnionToIntersection<FilteredBy<Filters[number]>> & Update
> => {
  return (update): update is UnionToIntersection<FilteredBy<Filters[number]>> & Update => {
    return filters.every((filter) => matches(filter, update));
  };
};
