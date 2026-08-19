import { BaseApi } from '../../base-api';
import { FlattenReq } from '../types';
import {
  DeleteCommentDTO, DeleteCommentResponse,
  EditCommentDTO, EditCommentResponse,
  GetCommentDTO,
  GetCommentResponse,
  GetCommentsDTO,
  GetCommentsResponse,
  SendCommentDTO,
  SendCommentResponse,
} from './types';

export class CommentsApi extends BaseApi {
  get = async ({
    messageId, ...query
  }: FlattenReq<GetCommentsDTO>): Promise<GetCommentsResponse> => {
    return this._get('messages/{messageId}/comments', { path: { messageId }, query });
  };

  getById = async ({
    messageId, commentId,
  }: FlattenReq<GetCommentDTO>): Promise<GetCommentResponse> => {
    return this._get('messages/{messageId}/comments/{commentId}', { path: { messageId, commentId } });
  };

  send = async ({
    messageId, disable_link_preview, ...body
  }: FlattenReq<SendCommentDTO>): Promise<SendCommentResponse> => {
    return this._post('messages/{messageId}/comments', { path: { messageId }, query: { disable_link_preview }, body });
  };

  edit = async ({
    messageId, comment_id, ...body
  }: FlattenReq<EditCommentDTO>): Promise<EditCommentResponse> => {
    return this._put('messages/{messageId}/comments', { path: { messageId }, query: { comment_id }, body });
  };

  delete = async ({
    messageId, comment_id,
  }: FlattenReq<DeleteCommentDTO>): Promise<DeleteCommentResponse> => {
    return this._delete('messages/{messageId}/comments', { path: { messageId }, query: { comment_id } });
  };
}
