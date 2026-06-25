import { setTimeout } from 'node:timers/promises';
import createDebug from 'debug';
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

const debug = createDebug('one-me:messages');

/** Максимальное количество повторов при ошибке attachment.not.ready */
const ATTACHMENT_NOT_READY_MAX_RETRIES = 10;

/** Начальная задержка между повторами (мс). Удваивается после каждой попытки. */
const ATTACHMENT_NOT_READY_BASE_DELAY = 1_000;

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
    options?: { signal?: AbortSignal },
  ): Promise<SendMessageResponse> => {
    const signal = options?.signal;
    let lastError: MaxError | undefined;

    for (
      let attempt = 0;
      attempt < ATTACHMENT_NOT_READY_MAX_RETRIES;
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
        if (
          !(err instanceof MaxError)
          || err.code !== 'attachment.not.ready'
        ) {
          throw err;
        }
        lastError = err;
        const delay = ATTACHMENT_NOT_READY_BASE_DELAY * (2 ** attempt);
        debug(
          'Attachment not ready (attempt %d/%d), retrying in %dms',
          attempt + 1,
          ATTACHMENT_NOT_READY_MAX_RETRIES,
          delay,
        );
        await setTimeout(delay, undefined, { signal });
      }
    }

    throw lastError ?? new MaxError(500, {
      code: 'attachment.not.ready',
      message: `Attachment not ready after ${
        ATTACHMENT_NOT_READY_MAX_RETRIES
      } retries`,
    });
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
