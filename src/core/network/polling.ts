import createDebug from 'debug';

import { setTimeout } from 'node:timers/promises';
import type { Api } from '../../api';
import { MaxError, Update, UpdateType } from './api';

const debug = createDebug('max:polling');

const RETRY_INTERVAL = 5_000; // ms

export class Polling {
  private readonly abortController = new AbortController();

  private marker?: number;

  constructor(
    private readonly api: Api,
    private readonly allowedUpdates: UpdateType[] = [],
  ) {}

  loop = async (handleUpdate: (updates: Update) => Promise<void>) => {
    debug('Starting long polling');
    while (!this.abortController.signal.aborted) {
      try {
        const { updates, marker } = await this.api.getUpdates(this.allowedUpdates, {
          marker: this.marker,
        });
        this.marker = marker;
        await Promise.all(updates.map(handleUpdate));
      } catch (err) {
        if (err instanceof Error) {
          if (err.name === 'AbortError') return;
          if (
            err.name === 'FetchError'
              || (err instanceof MaxError && err.status === 429)
              || (err instanceof MaxError && err.status >= 500)
          ) {
            debug(`Failed to fetch updates, retrying after ${RETRY_INTERVAL}ms.`, err);
            await setTimeout(RETRY_INTERVAL);
            continue;
          }
        }
        throw err;
      }
    }
  };

  stop = () => {
    debug('Stopping long polling');
    this.abortController.abort();
  };
}
