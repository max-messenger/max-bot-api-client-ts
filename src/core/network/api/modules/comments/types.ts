import { ActionResponse, Message, MessageLinkType } from '../../types';
import type { FlattenReq } from '../types';

export type CommentMessage = Pick<Message, 'sender' | 'timestamp' | 'link' | 'body' | 'recipient'>;
type CommentDTOPath = {
  messageId: string;
};
type CommentDTOBody = {
  text?: string | null;
  link?: { type: MessageLinkType; mid: string } | null;
  format?: 'markdown' | 'html' | null;
};

export type GetCommentsDTO = {
  query: {
    count?: number;
    before?: number;
    after?: number;
    comment_ids?: string | null;
  },
  path: CommentDTOPath
};

export type GetCommentsExtra = Omit<FlattenReq<GetCommentsDTO>, 'comment_ids' | 'messageId'> & {
  comment_ids?: string[]
};

export type GetCommentsResponse = {
  messages: CommentMessage[];
};

export type GetCommentDTO = {
  path: {
    messageId: string;
    commentId: string;
  }
};
export type GetCommentResponse = CommentMessage;

export type SendCommentDTO = {
  query: {
    disable_link_preview?: boolean,
  }
  path: CommentDTOPath,
  body: CommentDTOBody
};
export type SendCommentExtra = Omit<FlattenReq<SendCommentDTO>, 'messageId' | 'text'>;
export type SendCommentResponse = {
  message: CommentMessage;
};

export type EditCommentDTO = {
  query: {
    comment_id: string;
  },
  path: CommentDTOPath,
  body: CommentDTOBody
};
export type EditCommentExtra = Omit<FlattenReq<EditCommentDTO>, 'messageId' | 'text' | 'comment_id'>;
export type EditCommentResponse = ActionResponse;

export type DeleteCommentDTO = {
  query: {
    comment_id: string;
  },
  path: CommentDTOPath,
};

export type DeleteCommentResponse = ActionResponse;
