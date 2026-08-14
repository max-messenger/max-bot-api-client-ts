import fs from 'fs';
import { StreamUploadProgressCallback } from '../../network/api';

export type FileSource = string | fs.ReadStream | Buffer;

export type UploadRequestOptions = {
  signal?: AbortSignal;
  onUploadProgress?: StreamUploadProgressCallback;
};

export type DefaultOptions = {
  timeout?: number;
  onUploadProgress?: StreamUploadProgressCallback;
};

export type UploadProgressContext = { totalUploadedBefore: number };

export type UploadFromSourceOptions = {
  source: FileSource;
  onUploadProgress?: StreamUploadProgressCallback;
};

export type UploadFromUrlOptions = {
  url: string;
  onUploadProgress?: StreamUploadProgressCallback;
};

export type UploadFromUrlOrSourceOptions = UploadFromSourceOptions | UploadFromUrlOptions;

export type BaseFile = {
  fileName: string;
};

export type FileStream = BaseFile & {
  stream: fs.ReadStream;
  contentLength: number;
};

export type FileBuffer = BaseFile & {
  buffer: Buffer;
};

export type UploadFile = FileStream | FileBuffer;

export type UploadImageOptions = UploadFromUrlOrSourceOptions & DefaultOptions;
export type UploadVideoOptions = UploadFromSourceOptions & DefaultOptions;
export type UploadFileOptions = UploadFromSourceOptions & DefaultOptions;
export type UploadAudioOptions = UploadFromSourceOptions & DefaultOptions;

export type UploadRangeChunkParams = {
  uploadUrl: string;
  chunk: Buffer | string;
  startByte: number;
  endByte: number;
  fileSize: number;
  fileName: string;
  onUploadProgress?: StreamUploadProgressCallback;
};

export type UploadStreamParams = {
  file: FileStream;
  uploadUrl: string;
  onUploadProgress?: StreamUploadProgressCallback;
};

export type UploadFromStreamParams = UploadStreamParams & {
  /**
   * Токен загрузки чанками (при наличии используется Content-Range)
   */
  token?: string;
  abortController?: AbortController;
};

export type UploadFromBufferParams = {
  file: FileBuffer;
  uploadUrl: string;
  /**
   * Токен загрузки
   */
  token?: string;
  abortController?: AbortController;
  onUploadProgress?: StreamUploadProgressCallback;
};
