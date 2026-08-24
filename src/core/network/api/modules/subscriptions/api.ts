import { BaseApi } from '../../base-api';
import { FlattenReq, SubscribeOnUpdatesDTO, UnsubscribeFromUpdatesDTO } from '../types';
import { GetUpdatesDTO } from './types';

export class SubscriptionsApi extends BaseApi {
  getUpdates = async ({ signal, ...query }: FlattenReq<GetUpdatesDTO>) => {
    return this._get('updates', { query, signal });
  };
  subscribe = async ({ signal, ...body }: FlattenReq<SubscribeOnUpdatesDTO>) => {
    return this._post('subscriptions', { signal, body })
  }
  unsubscribe = async ({ signal, ...query }: FlattenReq<UnsubscribeFromUpdatesDTO>) => {
    return this._delete('subscriptions', { signal, query })
  }
} 
