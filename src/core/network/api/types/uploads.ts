export type UploadType = 'image' | 'video' | 'audio' | 'file';

export type StreamUploadEvent = {
  ratio: number;
  loaded: number;
  total: number;
  percent: number;
};

export type StreamUploadOptions = {
  signal?: AbortSignal;
  onUploadProgress?: StreamUploadProgressCallback;
  headers?: Record<string, string>;
  responseType?: 'text' | 'json';
};

export type StreamUploadProgressCallback = (event: StreamUploadEvent) => void;
