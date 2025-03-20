export type ChatType = 'dialog' | 'chat' | 'channel';

export type ChatStatus = 'active' | 'removed' | 'left' | 'closed' | 'suspended';

export type Chat = {
  chat_id: number;
  type: ChatType;
  status: ChatStatus;
  title: string | null;
  icon: { url: string } | null;
  last_event_time: number;
  participants_count: number;
  owner_id?: number | null;
  participants?: { [key: string]: number | undefined } | null;
  is_public: boolean;
  link?: string | null;
  description?: string | null;
  dialog_with_user?: {} | null;
  messages_count?: number | null;
  chat_message_id?: string | null;
  pinned_message?: object | null;
};

export type SenderAction = 'typing_on' | 'sending_photo' | 'sending_video' | 'sending_audio' | 'sending_file' | 'mark_seen';

export type ChatPermissions = 'read_all_messages' | 'add_remove_members' | 'add_admins' | 'change_chat_info' | 'pin_message' | 'write';

export type ChatMember = {
  user_id: number;
  name: string;
  username: string | null;
  is_bot: boolean;
  last_activity_time: number;
  description?: string | null;
  avatar_url?: string;
  full_avatar_url?: string;
  last_access_time: number;
  is_owner: boolean;
  is_admin: boolean;
  join_time: number;
  permissions: ChatPermissions[] | null;
};
