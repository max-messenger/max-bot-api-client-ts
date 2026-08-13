export class XhrError extends Error {
  readonly status: number;

  readonly statusText: string;

  readonly data: unknown;

  readonly isTimeout: boolean;

  readonly isAborted: boolean;

  readonly isNetworkError: boolean;

  constructor(
    status: number,
    statusText: string,
    data?: unknown,
    kind?: 'timeout' | 'abort' | 'network',
  ) {
    super(`XMLHttpRequest failed with status ${status} ${statusText}`);
    this.name = 'XhrError';
    this.status = status;
    this.statusText = statusText;
    this.data = data;
    this.isTimeout = kind === 'timeout';
    this.isAborted = kind === 'abort';
    this.isNetworkError = kind === 'network';
  }
}
