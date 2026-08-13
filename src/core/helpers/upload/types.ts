import fs from 'fs';
import { XhrProgressEvent } from '../../network/xhr';

export type FileSource = string | fs.ReadStream | Buffer;

export type UploadProgressCallback = (event: XhrProgressEvent) => void;

export type UploadRequestOptions = {
  signal?: AbortSignal;
  onUploadProgress?: UploadProgressCallback;
};

export type DefaultOptions = {
  timeout?: number;
};

export type UploadFromSourceOptions = {
  source: FileSource;
  onProgress?: UploadProgressCallback;
};

export type UploadFromUrlOptions = {
  url: string;
  onProgress?: UploadProgressCallback;
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
  /**
   * URL для загрузки файла
   */
  uploadUrl: string;
  /**
   * Чанк данных для загрузки
   */
  chunk: Buffer | string;
  /**
   * Начальный байт в общем потоке файла
   */
  startByte: number;
  /**
   * Конечный байт в общем потоке файла
   */
  endByte: number;
  /**
   * Общий размер файла
   */
  fileSize: number;
  /**
   * Имя файла для загрузки
   */
  fileName: string;
  /**
   * Коллбек для получения статуса прогресса
   */
  onUploadProgress?: UploadProgressCallback;
};

export type UploadStreamParams = {
  /**
   * Файл для загрузки
   */
  file: FileStream;
  /**
   * URL для загрузки файла
   */
  uploadUrl: string;
  /**
   * Коллбек для получения статуса прогресса
   */
  onUploadProgress?: UploadProgressCallback;
};

export type UploadFromStreamParams = UploadStreamParams & {
  /**
   * Токен загрузки чанками (при наличии используется Content-Range)
   */
  token?: string;
  /**
   * Контроллер для отмены загрузки
   */
  abortController?: AbortController;
};

export type UploadFromBufferParams = {
  /**
   * Файл для загрузки
   */
  file: FileBuffer;
  /**
   * URL для загрузки файла
   */
  uploadUrl: string;
  /**
   * Токен загрузки
   */
  token?: string;
  /**
   * Контроллер для отмены загрузки
   */
  abortController?: AbortController;
  /**
   * Коллбек для получения статуса прогресса
   */
  onUploadProgress?: UploadProgressCallback;
};
