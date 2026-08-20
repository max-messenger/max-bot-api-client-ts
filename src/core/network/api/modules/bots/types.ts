import type { BotCommand, BotInfo } from '../../types';

export type GetMyInfoResponse = BotInfo;

export type EditMyCommandsDTO = {
  body: {
    commands: BotCommand[]
  }
};

export type EditMyCommandsResponse = {
  commands: BotCommand[]
};
