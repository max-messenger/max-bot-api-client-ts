import { Chat } from './chat';
import { ConstructedMessage, Message } from './message';
import { User, UserLocale } from './user';

type MakeUpdate<Type extends string, Payload extends object> = {
  update_type: Type;
  timestamp: number;
} & {
  [key in keyof Payload]: Payload[key];
};

export type MessageCallbackUpdate = MakeUpdate<'message_callback', {
  callback: {
    timestamp: number;
    callback_id: string;
    payload?: string;
    user: User;
  }
  message?: Message | null;
  user_locale?: UserLocale | null;
}>;

export type MessageCreatedUpdate = MakeUpdate<'message_created', {
  message: Message;
  user_locale?: UserLocale | null;
}>;

export type MessageRemovedUpdate = MakeUpdate<'message_removed', {
  message_id: string;
  chat_id: number;
  user_id: number;
}>;

export type MessageEditedUpdate = MakeUpdate<'message_edited', {
  message: Message;
}>;

export type BotAddedUpdate = MakeUpdate<'bot_added', {
  chat_id: number;
  user: User;
  is_channel: boolean;
}>;

export type BotRemovedUpdate = MakeUpdate<'bot_removed', {
  chat_id: number;
  user: User;
  is_channel: boolean;
}>;

export type UserAddedUpdate = MakeUpdate<'user_added', {
  chat_id: number;
  user: User;
  inviter_id?: number | null;
  is_channel: boolean;
}>;

export type UserRemovedUpdate = MakeUpdate<'user_removed', {
  chat_id: number;
  user: User;
  admin_id?: number | null;
  is_channel: boolean;
}>;

export type BotStartedUpdate = MakeUpdate<'bot_started', {
  chat_id: number;
  user: User;
  payload?: string | null;
  user_locale?: UserLocale;
}>;

export type ChatTitleChangedUpdate = MakeUpdate<'chat_title_changed', {
  chat_id: number;
  user: User;
  title: string;
}>;

export type MessageConstructionRequestUpdate = MakeUpdate<'message_construction_request', {
  user: User;
  user_locale?: UserLocale;
  session_id: string;
  data?: string | null;
  input: unknown;
}>;

export type MessageConstructedUpdate = MakeUpdate<'message_constructed', {
  user: User;
  session_id: string;
  message: ConstructedMessage;
}>;

export type MessageChatCreatedUpdate = MakeUpdate<'message_chat_created', {
  chat: Chat;
  message_id: string;
  start_payload?: string | null;
}>;

export type UpdateType = Update['update_type'];

export type FilteredUpdate<Type extends UpdateType> =
    | Type extends 'message_callback' ? MessageCallbackUpdate
      : Type extends 'message_created' ? MessageCreatedUpdate
        : Type extends 'message_removed' ? MessageRemovedUpdate
          : Type extends 'message_edited' ? MessageEditedUpdate
            : Type extends 'bot_added' ? BotAddedUpdate
              : Type extends 'bot_removed' ? BotRemovedUpdate
                : Type extends 'user_added' ? UserAddedUpdate
                  : Type extends 'user_removed' ? UserRemovedUpdate
                    : Type extends 'bot_started' ? BotStartedUpdate
                      : Type extends 'chat_title_changed' ? ChatTitleChangedUpdate
                        : Type extends 'message_construction_request' ? MessageConstructionRequestUpdate
                          : Type extends 'message_constructed' ? MessageConstructedUpdate
                            : Type extends 'message_chat_created' ? MessageChatCreatedUpdate
                              : never;

export type Update =
  | MessageCallbackUpdate
  | MessageCreatedUpdate
  | MessageRemovedUpdate
  | MessageEditedUpdate
  | BotAddedUpdate
  | BotRemovedUpdate
  | UserAddedUpdate
  | UserRemovedUpdate
  | BotStartedUpdate
  | ChatTitleChangedUpdate
  | MessageConstructionRequestUpdate
  | MessageConstructedUpdate
  | MessageChatCreatedUpdate;
