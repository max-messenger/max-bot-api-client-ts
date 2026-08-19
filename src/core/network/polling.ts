import createDebug from 'debug';

import { setTimeout } from 'node:timers/promises';
import type { Api } from '../../api';
import { MaxError, Update, UpdateType } from './api';

const debug = createDebug('max:polling');

const BASE_DELAY_MS = 5_000; // ms
const MAX_DELAY_MS = 30_000; // ms

export class Polling {
  private readonly abortController = new AbortController();

  private marker?: number;

  constructor(
    private readonly api: Api,
    private readonly allowedUpdates: UpdateType[] = [],
  ) {}

  loop = async (handleUpdate: (updates: Update) => Promise<void>) => {
    debug('Starting long polling');

    let delayOnError = BASE_DELAY_MS;

    while (!this.abortController.signal.aborted) {
      try {
        const { updates, marker } = await this.api.getUpdates(this.allowedUpdates, {
          marker: this.marker,
        });

        delayOnError = BASE_DELAY_MS;

        this.marker = marker;
        await Promise.all(updates.map(handleUpdate));
      } catch (err) {
        if (err instanceof Error) {
          if (err.name === 'AbortError') return;

          if (this.shouldRetry(err)) {
            debug(`Failed to fetch updates, retrying after ${delayOnError}ms.`, err);

            try {
              await setTimeout(delayOnError, undefined, {
                signal: this.abortController.signal,
              });
            } catch (timeoutErr: unknown) {
              if (timeoutErr instanceof Error && timeoutErr.name === 'AbortError') return;
              throw timeoutErr;
            }

            delayOnError = Math.min(delayOnError * 2, MAX_DELAY_MS);
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

  private shouldRetry = (err: unknown): boolean => {
    if (!(err instanceof Error)) return false;
    if (err instanceof MaxError) return err.status === 429 || err.status >= 500;
    return err.name === 'FetchError' || err.name === 'TypeError';
  };
}
