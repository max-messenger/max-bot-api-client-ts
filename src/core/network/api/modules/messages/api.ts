import { setTimeout } from 'node:timers/promises';
import createDebug from 'debug';
import { BaseApi } from '../../base-api';
import { MaxError } from '../../error';
import {
  type AnswerOnCallbackDTO,
  EditMessageDTO,
  FlattenReq,
  GetMessageDTO,
  GetMessageResponse,
  GetMessagesDTO,
  GetMessagesResponse, GetVideoInfoDTO, GetVideoInfoResponse,
  SendMessageOptions,
  SendMessageResponse,
} from '../types';
import { SEND_MESSAGE_RETRIES_COUNT, SEND_MESSAGE_RETRY_DELAY_BASE_TIME } from './const';
import type { DeleteMessageDTO, SendMessageDTO } from './types';

const debug = createDebug('max:messages');
 
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

  send = async (
    {
      chat_id, user_id, disable_link_preview, ...body
    }: FlattenReq<SendMessageDTO>,
    options?: SendMessageOptions,
  ): Promise<SendMessageResponse> => {
    const signal = options?.signal;
    let lastError: MaxError | undefined;

    for (
      let attempt = 0;
      attempt < SEND_MESSAGE_RETRIES_COUNT;
      attempt += 1
    ) {
      signal?.throwIfAborted();

      try {
        return await this._post('messages', {
          body,
          query: { chat_id, user_id, disable_link_preview },
          signal,
        });
      } catch (err) {
        const isCriticalError = !(err instanceof MaxError) || err.code !== 'attachment.not.ready';

        if (isCriticalError) {
          throw err;
        }

        lastError = err;
        const delay = SEND_MESSAGE_RETRY_DELAY_BASE_TIME * (2 ** attempt);
        debug(
          'Attachment not ready (attempt %d/%d), retrying in %dms',
          attempt + 1,
          SEND_MESSAGE_RETRIES_COUNT,
          delay,
        );
        await setTimeout(delay, undefined, { signal });
      }
    }

    throw lastError ?? new MaxError(500, {
      code: 'attachment.not.ready',
      message: `Attachment not ready after ${
        SEND_MESSAGE_RETRIES_COUNT
      } retries`,
    });
  };

  edit = async ({ message_id, ...body }: FlattenReq<EditMessageDTO>) => {
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

  getVideoInfo = async ({ ...query }: FlattenReq<GetVideoInfoDTO>): Promise<GetVideoInfoResponse> => {
    return this._get('videos/{video_token}', {
      query,
    });
  };

  answerOnCallback = async ({ callback_id, ...body }: FlattenReq<AnswerOnCallbackDTO>) => {
    return this._post('answers', {
      query: { callback_id },
      body,
    });
  };
}
