import { BaseApi } from '../../base-api';
import { FlattenReq } from '../types';
import { GetUpdatesDTO } from './types';

export class SubscriptionsApi extends BaseApi {
  getUpdates = async ({ ...query }: FlattenReq<GetUpdatesDTO>) => {
    return this._get('updates', { query });
  };
}
