import {
  ActionResponse, AttachmentRequest, Message, MessageLinkType,
} from '../../types';
import type { FlattenReq } from '../types';

export type GetMessageDTO = {
  path: {
    message_id: string;
  }
};

export type GetMessageResponse = Message;

export type GetMessagesDTO = {
  query: {
    chat_id?: number;
    message_ids?: string | null;
    from?: number;
    to?: number;
    count?: number;
  }
};

export type GetMessagesExtra = Omit<FlattenReq<GetMessagesDTO>, 'chat_id' | 'message_ids'> & {
  message_ids?: string[]
};

export type GetMessagesResponse = {
  messages: Message[]
};

export type SendMessageDTO = {
  query: {
    user_id?: number;
    chat_id?: number;
    disable_link_preview?: boolean,
  },
  body: {
    text?: string | null;
    attachments?: AttachmentRequest[] | null;
    link?: { type: MessageLinkType; mid: string } | null;
    notify?: boolean;
    format?: 'markdown' | 'html' | null;
  }
};

export type SendMessageExtra = Omit<FlattenReq<SendMessageDTO>, 'chat_id' | 'user_id' | 'text'>;

export type SendMessageResponse = {
  message: Message
};

export type DeleteMessageDTO = {
  query: {
    message_id: string;
  }
};

export type DeleteMessageExtra = Omit<FlattenReq<DeleteMessageDTO>, 'message_id'>;

export type DeleteMessageResponse = ActionResponse;

export type EditMessageDTO = {
  query: {
    message_id: string
  },
  body: SendMessageDTO['body']
};

export type EditMessageExtra = Omit<FlattenReq<EditMessageDTO>, 'message_id'>;

export type EditMessageResponse = ActionResponse;

export type AnswerOnCallbackDTO = {
  query: {
    callback_id: string
  },
  body: {
    message?: SendMessageDTO['body'] | null,
    notification?: string | null
  }
};

export type AnswerOnCallbackExtra = Omit<FlattenReq<AnswerOnCallbackDTO>, 'callback_id'>;

export type AnswerOnCallbackResponse = ActionResponse;
