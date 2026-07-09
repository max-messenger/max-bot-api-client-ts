import { BaseApi } from '../../base-api';
import type { FlattenReq } from '../types';
import type { EditMyCommandsDTO } from './types';

export class BotsApi extends BaseApi {
  getMyInfo = async () => {
    return this._get('me', {});
  };

  editMyCommands = async ({ ...body }: FlattenReq<EditMyCommandsDTO>) => {
    return this._patch('me/commands', { body });
  };
}
