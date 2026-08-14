import type { ReadStream } from 'fs';
import type { StreamUploadProgressCallback } from '../../network/api';

export type FileSource = string | ReadStream | Buffer;

type WithUploadProgress = {
  onUploadProgress?: StreamUploadProgressCallback;
};

export interface UploadRequestOptions extends WithUploadProgress {
  signal?: AbortSignal;
}

export interface DefaultOptions extends WithUploadProgress {
  timeout?: number;
}

export type UploadProgressContext = {
  totalUploadedBefore: number;
};

export interface UploadFromSourceOptions extends WithUploadProgress {
  source: FileSource;
}

export interface UploadFromUrlOptions extends WithUploadProgress {
  url: string;
}

export type UploadFromUrlOrSourceOptions = UploadFromSourceOptions | UploadFromUrlOptions;

export type BaseFile = {
  fileName: string;
};

export interface FileStream extends BaseFile {
  stream: ReadStream;
  contentLength: number;
}

export interface FileBuffer extends BaseFile {
  buffer: Buffer;
}

export type UploadFile = FileStream | FileBuffer;

export type UploadImageOptions = UploadFromUrlOrSourceOptions & DefaultOptions;
export type UploadVideoOptions = UploadFromSourceOptions & DefaultOptions;
export type UploadFileOptions = UploadFromSourceOptions & DefaultOptions;
export type UploadAudioOptions = UploadFromSourceOptions & DefaultOptions;

export interface UploadRangeChunkParams extends WithUploadProgress {
  uploadUrl: string;
  chunk: Buffer | string;
  startByte: number;
  endByte: number;
  fileSize: number;
  fileName: string;
}

export interface UploadStreamParams extends WithUploadProgress {
  file: FileStream;
  uploadUrl: string;
}

export interface UploadFromStreamParams extends UploadStreamParams {
  /**
   * Токен загрузки чанками (при наличии используется Content-Range)
   */
  token?: string;
  abortController?: AbortController;
}

export interface UploadFromBufferParams extends WithUploadProgress {
  file: FileBuffer;
  uploadUrl: string;
  /**
   * Токен загрузки
   */
  token?: string;
  abortController?: AbortController;
}
