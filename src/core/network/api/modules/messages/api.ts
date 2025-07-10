import { setTimeout } from 'node:timers/promises';
import { MaxError } from '../../error';
import { BaseApi } from '../../base-api';
import type {
  FlattenReq,
  GetMessageDTO,
  GetMessageResponse,
  GetMessagesDTO,
  GetMessagesResponse,
  SendMessageResponse,
} from '../types';
import type { SendMessageDTO, DeleteMessageDTO } from './types';

export class MessagesApi extends BaseApi {
  get = async ({ ...query }: FlattenReq<GetMessagesDTO>): Promise<GetMessagesResponse> => {
    return this._get('messages', {
      query,
    });
  };

  getById = async ({ message_id }: FlattenReq<GetMessageDTO>): Promise<GetMessageResponse> => {
    return this._get('messages/{message_id}', {
      path: { message_id },
    });
  };

  send = async ({
    chat_id, user_id, disable_link_preview, ...body
  }: FlattenReq<SendMessageDTO>): Promise<SendMessageResponse> => {
    try {
      return await this._post('messages', {
        body,
        query: { chat_id, user_id, disable_link_preview },
      });
    } catch (err) {
      if (err instanceof MaxError) {
        if (err.code === 'attachment.not.ready') {
          console.log('Attachment not ready');
          await setTimeout(1000);
          return this.send({
            chat_id, user_id, disable_link_preview, ...body,
          });
        }
      }
      throw err;
    }
  };

  edit = async ({ message_id, ...body }) => {
    return this._put('messages', {
      query: { message_id },
      body,
    });
  };

  delete = async ({ ...query }: FlattenReq<DeleteMessageDTO>) => {
    return this._delete('messages', {
      query,
    });
  };

  answerOnCallback = async ({ callback_id, ...body }) => {
    return this._post('answers', {
      query: { callback_id },
      body,
    });
  };
}
