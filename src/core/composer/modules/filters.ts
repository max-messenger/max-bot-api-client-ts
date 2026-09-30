import type {
  FilteredUpdate, MessageBody, MessageCallbackUpdate,
  MessageCreatedUpdate, MessageEditedUpdate, Update, UpdateType,
} from '../../network/api';
import type { Guard } from '../../types';

type UpdateFilter = UpdateType | Guard<Update>;

/** Определяет тип события после проверки по имени или type guard. */
type FilteredBy<Filter> = Filter extends UpdateType
  ? FilteredUpdate<Filter>
  : Filter extends Guard<Update, infer U>
    ? U
    : never;

type UnionToIntersection<Union> = (
  Union extends unknown ? (value: Union) => void : never
) extends (value: infer Intersection) => void ? Intersection : never;

const matches = (filter: UpdateFilter, update: Update) => {
  // Комбинаторы используют одну проверку, но по-разному объединяют её результаты.
  return typeof filter === 'function'
    ? filter(update)
    : update.update_type === filter;
};

export const createdMessageBodyHas = <Keys extends Array<keyof MessageBody>>(...keys: Keys) => {
  return (update: Update): update is MessageCreatedUpdate => {
    // Поле со значением undefined или null считаем отсутствующим.
    if (update.update_type !== 'message_created') return false;
    // Сервер может прислать message_created без объекта message (см. issue #250).
    const body = update.message?.body;
    if (!body) return false;
    for (const key of keys) {
      if (!(key in body)) return false;
      if (body[key] == null) return false;
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

/** Создаёт guard, которому достаточно совпадения хотя бы с одним фильтром. */
export const anyOf = <Filters extends UpdateFilter[]>(...filters: Filters): Guard<
Update,
FilteredBy<Filters[number]>
> => {
  return (update): update is FilteredBy<Filters[number]> => {
    return filters.some((filter) => matches(filter, update));
  };
};

/** Создаёт guard, для которого должны одновременно выполниться все фильтры. */
export const allOf = <Filters extends UpdateFilter[]>(...filters: Filters): Guard<
Update,
UnionToIntersection<FilteredBy<Filters[number]>> & Update
> => {
  return (update): update is UnionToIntersection<FilteredBy<Filters[number]>> & Update => {
    return filters.every((filter) => matches(filter, update));
  };
};
