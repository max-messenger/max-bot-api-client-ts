import {
  ActionResponse, Chat, ChatMember, Message, type PhotoAttachmentRequestPayload, SenderAction,
} from '../../types';
import { FlattenReq } from '../types';

export type GetAllChatsDTO = {
  query: {
    count?: number;
    marker?: number | null;
  }
};

export type GetAllChatsExtra = FlattenReq<GetAllChatsDTO>;

type DefaultPath = {
  chat_id: number;
};

export type GetAllChatsResponse = {
  chats: Chat[];
  marker: number | null;
};

export type GetChatByIdDTO = {
  path: DefaultPath
};

export type GetChatByIdResponse = Chat;

export type GetChatByLinkDTO = {
  path: {
    chat_link: string
  }
};

export type GetChatByLinkResponse = Chat;

export type EditChatInfoDTO = {
  path: DefaultPath,
  body: {
    icon?: PhotoAttachmentRequestPayload | null;
    title?: string | null;
    pin?: string | null;
    notify?: boolean | null;
  }
};

export type EditChatExtra = Omit<FlattenReq<EditChatInfoDTO>, 'chat_id'>;

export type EditChatInfoResponse = Chat;

export type SendActionDTO = {
  path: DefaultPath,
  body: {
    action: SenderAction,
  }
};

export type SendActionResponse = ActionResponse;

export type GetPinnedMessageDTO = {
  path: DefaultPath,
};

export type GetPinnedMessageResponse = {
  message: Message | null
};

export type PinMessageDTO = {
  path: DefaultPath,
  body: {
    message_id: string;
    notify?: boolean | null;
  }
};

export type PinMessageExtra = Omit<FlattenReq<PinMessageDTO>, 'chat_id' | 'message_id'>;

export type PinMessageResponse = ActionResponse;

export type UnpinMessageDTO = {
  path: DefaultPath;
};

export type UnpinMessageResponse = ActionResponse;

export type GetChatMembershipDTO = {
  path: DefaultPath;
};

export type GetChatMembershipResponse = ChatMember;

export type LeaveChatDTO = {
  path: DefaultPath;
};

export type LeaveChatResponse = ActionResponse;

export type GetChatAdminsDTO = {
  path: DefaultPath;
};

export type GetChatAdminsResponse = {
  members: ChatMember[],
  marker?: number | null;
};

export type GetChatMembersDTO = {
  path: DefaultPath;
  query: {
    user_ids?: string;
    marker?: number;
    count?: number;
  }
};

export type GetChatMembersExtra = Omit<FlattenReq<GetChatMembersDTO>, 'chat_id' | 'user_ids'> & {
  user_ids?: number[];
};

export type GetChatMembersResponse = {
  members: ChatMember[],
  marker?: number | null;
};

export type AddChatMembersDTO = {
  path: DefaultPath;
  body: {
    user_ids: number[];
  }
};

export type AddChatMembersResponse = ActionResponse;

export type RemoveChatMemberDTO = {
  path: DefaultPath;
  body: {
    user_id: number;
    block?: boolean;
  }
};

export type RemoveChatMemberResponse = ActionResponse;
