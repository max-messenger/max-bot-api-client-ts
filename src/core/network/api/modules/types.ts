import { ReqOptions } from '../client';
import type { EditMyCommandsDTO, EditMyCommandsResponse, GetMyInfoResponse } from './bots/types';
import {
  AddChatAdminsDTO,
  AddChatAdminsResponse,
  AddChatMembersDTO,
  AddChatMembersResponse,
  DeleteAdminChatMemberDTO,
  DeleteAdminChatMemberResponse,
  EditChatInfoDTO,
  EditChatInfoResponse,
  GetAllChatsDTO,
  GetAllChatsResponse,
  GetChatAdminsDTO,
  GetChatAdminsResponse,
  GetChatByIdDTO,
  GetChatByIdResponse,
  GetChatMembersDTO,
  GetChatMembershipDTO,
  GetChatMembershipResponse,
  GetChatMembersResponse,
  GetPinnedMessageDTO,
  GetPinnedMessageResponse,
  LeaveChatDTO,
  LeaveChatResponse,
  PinMessageDTO,
  PinMessageResponse,
  RemoveChatMemberDTO,
  RemoveChatMemberResponse,
  SendActionDTO,
  SendActionResponse,
  UnpinMessageDTO,
  UnpinMessageResponse,
} from './chats/types';
import {
  DeleteCommentDTO, DeleteCommentResponse,
  EditCommentDTO, EditCommentResponse,
  GetCommentDTO, GetCommentResponse,
  GetCommentsDTO, GetCommentsResponse,
  SendCommentDTO, SendCommentResponse,
} from './comments/types';
import {
  AnswerOnCallbackDTO, AnswerOnCallbackResponse,
  DeleteMessageDTO, DeleteMessageResponse,
  EditMessageDTO, EditMessageResponse,
  GetMessageDTO, GetMessageResponse,
  GetMessagesDTO, GetMessagesResponse, GetVideoInfoDTO, GetVideoInfoResponse,
  SendMessageDTO, SendMessageResponse,
} from './messages/types';
import {
  GetUpdatesDTO,
  GetUpdatesResponse,
  SubscribeOnUpdatesDTO, SubscribeOnUpdatesResponse, SubscriptionsResponseDTO,
  UnsubscribeFromUpdatesDTO, UnsubscribeFromUpdatesResponse
} from './subscriptions/types';
import { GetUploadUrlDTO, GetUploadUrlResponse } from './uploads/types';

export * from './bots/types';
export * from './messages/types';
export * from './subscriptions/types';

export type FlattenReq<T extends Omit<ReqOptions, 'method'>> = T['body'] & T['query'] & T['path'] & Pick<ReqOptions, 'signal'>;

export type ApiMethods = {
  GET: {
    chats: {
      req: GetAllChatsDTO,
      res: GetAllChatsResponse,
    },
    'chats/{chat_id}': {
      req: GetChatByIdDTO,
      res: GetChatByIdResponse,
    },
    'chats/{chat_id}/members/admins': {
      req: GetChatAdminsDTO,
      res: GetChatAdminsResponse,
    },
    'chats/{chat_id}/members': {
      req: GetChatMembersDTO,
      res: GetChatMembersResponse,
    },
    'chats/{chat_id}/members/me': {
      req: GetChatMembershipDTO,
      res: GetChatMembershipResponse,
    },
    'chats/{chat_id}/pin': {
      req: GetPinnedMessageDTO,
      res: GetPinnedMessageResponse,
    },
    me: {
      req: {},
      res: GetMyInfoResponse,
    },
    updates: {
      req: GetUpdatesDTO,
      res: GetUpdatesResponse,
    },
    messages: {
      req: GetMessagesDTO,
      res: GetMessagesResponse,
    },
    'messages/{message_id}': {
      req: GetMessageDTO,
      res: GetMessageResponse,
    },
    'messages/{messageId}/comments': {
      req: GetCommentsDTO,
      res: GetCommentsResponse,
    }
    'messages/{messageId}/comments/{commentId}': {
      req: GetCommentDTO,
      res: GetCommentResponse
    },
    'videos/{video_token}': {
      req: GetVideoInfoDTO,
      res: GetVideoInfoResponse
    },
    'subscriptions': {
      req: {},
      res: SubscriptionsResponseDTO,
    }
  },
  POST: {
    'chats/{chat_id}/actions': {
      req: SendActionDTO,
      res: SendActionResponse,
    },
    'chats/{chat_id}/members': {
      req: AddChatMembersDTO,
      res: AddChatMembersResponse,
    },
    messages: {
      req: SendMessageDTO,
      res: SendMessageResponse,
    },
    uploads: {
      req: GetUploadUrlDTO,
      res: GetUploadUrlResponse,
    },
    answers: {
      req: AnswerOnCallbackDTO,
      res: AnswerOnCallbackResponse,
    },
    'messages/{messageId}/comments': {
      req: SendCommentDTO,
      res: SendCommentResponse,
    },
    'chats/{chat_id}/members/admins': {
      req: AddChatAdminsDTO,
      res: AddChatAdminsResponse,
    },
    'subscriptions': {
      req: SubscribeOnUpdatesDTO,
      res: SubscribeOnUpdatesResponse,
    },
  },
  PATCH: {
    'me/commands': {
      req: EditMyCommandsDTO,
      res: EditMyCommandsResponse,
    },
    'chats/{chat_id}': {
      req: EditChatInfoDTO,
      res: EditChatInfoResponse,
    }
  },
  PUT: {
    messages: {
      req: EditMessageDTO,
      res: EditMessageResponse,
    },
    'chats/{chat_id}/pin': {
      req: PinMessageDTO,
      res: PinMessageResponse,
    },
    'messages/{messageId}/comments': {
      req: EditCommentDTO,
      res: EditCommentResponse,
    }
  },
  DELETE: {
    messages: {
      req: DeleteMessageDTO,
      res: DeleteMessageResponse,
    },
    'chats/{chat_id}/pin': {
      req: UnpinMessageDTO,
      res: UnpinMessageResponse,
    },
    'chats/{chat_id}/members': {
      req: RemoveChatMemberDTO,
      res: RemoveChatMemberResponse,
    },
    'chats/{chat_id}/members/me': {
      req: LeaveChatDTO,
      res: LeaveChatResponse,
    },
    'messages/{messageId}/comments': {
      req: DeleteCommentDTO,
      res: DeleteCommentResponse,
    }
    subscriptions: {
      req: UnsubscribeFromUpdatesDTO,
      res: UnsubscribeFromUpdatesResponse,
    }
    'chats/{chat_id}/members/admins/{user_id}': {
      req: DeleteAdminChatMemberDTO,
      res: DeleteAdminChatMemberResponse,
    }
  }
};
