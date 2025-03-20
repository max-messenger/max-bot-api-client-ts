import { BaseApi } from '../../base-api';
import { FlattenReq } from '../types';

import { GetUploadUrlDTO } from './types';

export class UploadsApi extends BaseApi {
  getUploadUrl = async ({ ...query }: FlattenReq<GetUploadUrlDTO>) => {
    return this._post('uploads', { query });
  };
}
