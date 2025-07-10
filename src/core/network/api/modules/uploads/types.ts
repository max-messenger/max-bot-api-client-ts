import { UploadType } from '../../types';

export type GetUploadUrlDTO = {
  query: {
    type: UploadType
  }
};

export type GetUploadUrlResponse = {
  url: string,
  token?: string,
};
