import { Message } from './message';
import { UserWithPhoto } from './user';

export type ChatType = 'dialog' | 'chat' | 'channel';

export type ChatStatus = 'active' | 'removed' | 'left' | 'closed';

export type Chat = {
  chat_id: number;
  type: ChatType;
  status: ChatStatus;
  title: string | null;
  icon: { url: string } | null;
  last_event_time: number;
  participants_count: number;
  owner_id?: number | null;
  /**
   * Список участников в формате ключ-значение, где ключ — идентификатор участника user_id,
   * а значение — время его последней активности в чате или канале last_event_time.
   */
  participants?: { [key: string]: number | undefined } | null;
  is_public: boolean;
  link?: string | null;
  description?: string | null;
  /**
   * Данные о пользователе в диалоге (только для чатов типа "dialog")
   */
  dialog_with_user?: UserWithPhoto | null;
  messages_count?: number | null;
  pinned_message?: Message | null;
};

export type SenderAction = 'typing_on' | 'sending_photo' | 'sending_video' | 'sending_audio' | 'sending_file';

export type ChatPermissions =
  | 'read_all_messages'
  | 'add_remove_members'
  | 'add_admins'
  | 'change_chat_info'
  | 'pin_message'
  | 'write'
  | 'can_call'
  | 'edit_link'
  | 'post_edit_delete_message'
  | 'edit_message'
  | 'delete_message'
  | 'edit'
  | 'delete';

export type ChatMember = UserWithPhoto & {
  last_access_time: number;
  is_owner: boolean;
  is_admin: boolean;
  join_time: number;
  permissions: ChatPermissions[] | null;
  alias?: string;
};

export type ChatAdmin = Pick<UserWithPhoto, 'user_id'> & Pick<ChatMember, 'alias'> & {
  permissions: ChatPermissions[];
}
