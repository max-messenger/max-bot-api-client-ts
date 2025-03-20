import { Update } from '../../types';

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
