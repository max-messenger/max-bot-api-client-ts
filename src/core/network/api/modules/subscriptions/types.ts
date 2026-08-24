import {ActionResponse, Update, UpdateType} from '../../types';

export type GetUpdatesDTO = {
  query: {
    limit?: number;
    timeout?: number;
    marker?: number;
    types?: string;
  };
};

export type GetUpdatesResponse = {
  updates: Update[];
  marker: number;
};

export type SubscribeOnUpdatesDTO = {
  body: {
    url: string;
    update_types?: UpdateType[]
    secret: string
  }
}

export type SubscribeOnUpdatesResponse = ActionResponse

export type UnsubscribeFromUpdatesDTO = {
  query: {
    url: string;
  }
}

export type UnsubscribeFromUpdatesResponse = ActionResponse