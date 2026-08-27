import { SubscriptionDTO } from '../modules';
import { Message } from './message';
import { User, UserLocale } from './user';

type MakeUpdate<Type extends string, Payload extends object> = {
  update_type: Type;
  timestamp: number;
} & {
  [key in keyof Payload]: Payload[key];
};

export type BotAddedUpdate = MakeUpdate<'bot_added', {
  chat_id: number;
  user: User;
  is_channel: boolean;
}>;

export type BotStartedUpdate = MakeUpdate<'bot_started', {
  chat_id: number;
  user: User;
  payload?: string | null;
  user_locale?: UserLocale;
}>;

export type BotStoppedUpdate = MakeUpdate<'bot_stopped', {
  chat_id: number;
  user: User;
  payload?: string | null;
  user_locale?: UserLocale;
}>;

export type BotRemovedUpdate = MakeUpdate<'bot_removed', {
  chat_id: number;
  user: User;
  is_channel: boolean;
}>;

export type ChatTitleChangedUpdate = MakeUpdate<'chat_title_changed', {
  chat_id: number;
  user: User;
  title: string;
}>;

export type DialogClearedUpdate = MakeUpdate<'dialog_cleared', {
  chat_id: number;
  user: User;
  user_locale?: UserLocale;
}>;

export type DialogMutedUpdate = MakeUpdate<'dialog_muted', {
  chat_id: number;
  user: User;
  muted_until: number;
  user_locale?: UserLocale;
}>;

export type DialogUnmutedUpdate = MakeUpdate<'dialog_unmuted', {
  chat_id: number;
  user: User;
  user_locale?: UserLocale;
}>;

export type DialogRemovedUpdate = MakeUpdate<'dialog_removed', {
  chat_id: number;
  user: User;
  user_locale?: UserLocale;
}>;

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

export type MessageEditedUpdate = MakeUpdate<'message_edited', {
  message: Message;
}>;

export type MessageRemovedUpdate = MakeUpdate<'message_removed', {
  message_id: string;
  chat_id: number;
  user_id: number;
  post_id: string | null;
}>;

export type CommentCreatedUpdate = MakeUpdate<'comment_created', {
  message: Message;
}>;

export type CommentEditedUpdate = MakeUpdate<'comment_edited', {
  message: Message;
}>;

export type CommentRemovedUpdate = MakeUpdate<'comment_removed', {
  message_id: string;
  chat_id: number;
  user_id: number;
  post_id: string | null;
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

export type Update =
  | BotAddedUpdate
  | BotStartedUpdate
  | BotStoppedUpdate
  | BotRemovedUpdate
  | ChatTitleChangedUpdate
  | CommentCreatedUpdate
  | CommentEditedUpdate
  | CommentRemovedUpdate
  | DialogClearedUpdate
  | DialogMutedUpdate
  | DialogRemovedUpdate
  | DialogUnmutedUpdate
  | MessageCallbackUpdate
  | MessageCreatedUpdate
  | MessageEditedUpdate
  | MessageRemovedUpdate
  | UserAddedUpdate
  | UserRemovedUpdate;

export type UpdateMap = {
  bot_added: BotAddedUpdate;
  bot_removed: BotRemovedUpdate;
  bot_started: BotStartedUpdate;
  bot_stopped: BotStoppedUpdate;
  chat_title_changed: ChatTitleChangedUpdate;
  comment_created: CommentCreatedUpdate;
  comment_edited: CommentEditedUpdate;
  comment_removed: CommentRemovedUpdate;
  dialog_cleared: DialogClearedUpdate;
  dialog_muted: DialogMutedUpdate;
  dialog_removed: DialogRemovedUpdate;
  dialog_unmuted: DialogUnmutedUpdate;
  message_callback: MessageCallbackUpdate;
  message_created: MessageCreatedUpdate;
  message_edited: MessageEditedUpdate;
  message_removed: MessageRemovedUpdate;
  user_added: UserAddedUpdate;
  user_removed: UserRemovedUpdate;
};

export type UpdateType = Update['update_type'];

export type FilteredUpdate<Type extends UpdateType> = Type extends keyof UpdateMap
  ? UpdateMap[Type]
  : never;

export type Subscription = Omit<SubscriptionDTO, 'update_types'> & {
  updateTypes: SubscriptionDTO['update_types'];
}
