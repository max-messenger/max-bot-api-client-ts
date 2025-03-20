import { NullableObject } from '../../../helpers/types';

import { Button } from './keyboard';
import { User } from './user';

type MediaPayload = {
  url: string;
  token: string;
};

export type PhotoAttachment = {
  type: 'image';
  payload: MediaPayload & {
    photo_id: number;
  }
};

export type VideoAttachment = {
  type: 'video';
  payload: MediaPayload;
  thumbnail?: string | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
};

export type AudioAttachment = {
  type: 'audio';
  payload: MediaPayload;
};

export type FileAttachment = {
  type: 'file';
  payload: MediaPayload;
  filename: string;
  size: number;
};

export type StickerAttachment = {
  type: 'sticker';
  payload: {
    url: string;
    code: string
  };
  width: number;
  height: number;
};

export type ContactAttachment = {
  type: 'contact';
  payload: {
    vcf_info?: string | null;
    tam_info?: User | null;
  }
};

export type ShareAttachment = {
  type: 'share';
  payload: Partial<NullableObject<MediaPayload>>;
  title?: string | null;
  description?: string | null;
  image_url?: string | null;
};

export type LocationAttachment = {
  type: 'location';
  latitude: number;
  longitude: number;
};

export type InlineKeyboardAttachment = {
  type: 'inline_keyboard';
  payload: {
    buttons: Button[][]
  }
};

export type Attachment =
  | PhotoAttachment
  | VideoAttachment
  | AudioAttachment
  | FileAttachment
  | StickerAttachment
  | ContactAttachment
  | InlineKeyboardAttachment
  | ShareAttachment
  | LocationAttachment;
