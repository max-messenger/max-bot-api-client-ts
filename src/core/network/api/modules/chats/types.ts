import {
  ActionResponse, Chat, ChatAdmin, ChatMember, Message, type PhotoAttachmentRequestPayload, SenderAction,
} from '../../types';
import { FlattenReq } from '../types';

type DefaultPath = {
  chat_id: number;
};

export type GetChatByIdDTO = {
  path: DefaultPath
};

export type GetChatByIdResponse = Chat;

export type EditChatInfoDTO = {
  path: DefaultPath,
  body: {
    icon?: PhotoAttachmentRequestPayload | null;
    title?: string | null;
    pin?: string | null;
    notify?: boolean | null;
    description?: string | null;
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
  message?: Message | null
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

export type AddChatAdminsDTO = {
  path: DefaultPath;
  body: {
    admins: ChatAdmin[]
    marker?: number | null;
  }
}

export type AddChatAdminsResponse = ActionResponse;

export type AddChatAdminsExtra = Omit<FlattenReq<AddChatAdminsDTO>, 'chat_id' | 'admins' | 'signal'>

export type DeleteAdminChatMemberDTO = {
  path: DefaultPath & {
    user_id: number;
  };
}

export type DeleteAdminChatMemberResponse = ActionResponse;

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

type FailedUserDetails = {
  error_code: 'add.participant.privacy' | 'add.participant.not.found',
  user_ids: number[];
}

export type AddChatMembersResponse = ActionResponse & {
  failed_user_ids?: number[] | null;
  failed_user_details?: FailedUserDetails[] | null;
};

export type RemoveChatMemberDTO = {
  path: DefaultPath;
  query: {
    user_id: number;
    block?: boolean;
  }
};

export type RemoveChatMemberResponse = ActionResponse;
