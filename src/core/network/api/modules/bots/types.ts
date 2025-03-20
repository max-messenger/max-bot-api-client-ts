import type { BotCommand, BotInfo, PhotoAttachmentRequestPayload } from '../../types';

export type GetMyInfoResponse = BotInfo;

export type EditMyInfoDTO = {
  body: {
    name?: string | null;
    description?: string | null;
    commands?: BotCommand[] | null;
    photo?: PhotoAttachmentRequestPayload;
  }
};

export type EditMyInfoResponse = BotInfo;
