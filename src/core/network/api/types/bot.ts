import { UserWithPhoto } from './user';

export type BotCommand = {
  name: string;
  description?: string | null;
};

export type BotInfo = UserWithPhoto & {
  commands?: BotCommand[] | null;
};
