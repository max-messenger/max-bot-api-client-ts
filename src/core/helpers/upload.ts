import * as fs from 'fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { type Api } from '../../api';
import { MaxError, type UploadType } from '../network/api';

type FileSource = string | fs.ReadStream | Buffer;

type DefaultOptions = {
  timeout?: number;
};

type UploadFromSourceOptions = {
  source: FileSource
};

type UploadFromUrlOptions = {
  url: string
};

type UploadFromUrlOrSourceOptions = UploadFromSourceOptions | UploadFromUrlOptions;

type BaseFile = {
  fileName: string
};

type FileStream = BaseFile & {
  stream: fs.ReadStream;
  contentLength: number;
};

type FileBuffer = BaseFile & {
  buffer: Buffer;
};

type UploadFile = FileStream | FileBuffer;

export type UploadImageOptions = UploadFromUrlOrSourceOptions & DefaultOptions;
export type UploadVideoOptions = UploadFromSourceOptions & DefaultOptions;
export type UploadFileOptions = UploadFromSourceOptions & DefaultOptions;
export type UploadAudioOptions = UploadFromSourceOptions & DefaultOptions;

const DEFAULT_UPLOAD_TIMEOUT = 20_000; // ms

/**
 * Параметры загрузки чатка через Content-Range
 */
type UploadRangeChunkParams = {
  /**
   * URL для загрузки файла
   */
  uploadUrl: string;
  /**
   * Чанк-данных для загрузки
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
};

/**
 * Загрузить чанк данных через Content-Range запрос
 */
async function uploadRangeChunk({
  uploadUrl, chunk, startByte, endByte, fileSize, fileName,
}: UploadRangeChunkParams, { signal }: { signal?: AbortSignal } = {}) {
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    body: chunk,
    headers: {
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Range': `bytes ${startByte}-${endByte}/${fileSize}`,
      'Content-Type': 'application/x-binary; charset=x-user-defined',
      'X-File-Name': fileName,
      'X-Uploading-Mode': 'parallel',
      Connection: 'keep-alive',
    },
    signal,
  });

  if (uploadRes.status >= 400) {
    const error = await uploadRes.json();
    throw new MaxError(uploadRes.status, error);
  }

  return uploadRes.text();
}

/**
 * Параметры загрузки данных через Content-Range или Multipart запрос
 */
type UploadStreamParams = {
  /**
   * Файл для загрузки
   */
  file: FileStream;
  /**
   * URL для загрузки файла
   */
  uploadUrl: string;
};

/**
 * Загрузить файл через Content-Range запрос
 */
async function uploadRange(
  { uploadUrl, file }: UploadStreamParams,
  options: { signal?: AbortSignal } | undefined,
) {
  const size = file.contentLength;
  let startByte = 0;
  let endByte = 0;

  for await (const chunk of file.stream) {
    endByte = startByte + chunk.length - 1;
    await uploadRangeChunk({
      uploadUrl,
      startByte,
      endByte,
      chunk,
      fileName: file.fileName,
      fileSize: size,
    }, options);

    startByte = endByte + 1;
  }
}

/**
 * Загрузить файл через Multipart запрос
 */
async function uploadMultipart<Res>(
  { uploadUrl, file }: UploadStreamParams,
  { signal }: { signal?: AbortSignal } = {},
): Promise<Res> {
  const body = new FormData();
  body.append('data', {
    [Symbol.toStringTag]: 'File',
    name: file.fileName,
    stream: () => file.stream,
    size: file.contentLength,
  } as unknown as File);

  const result = await fetch(uploadUrl, {
    method: 'POST',
    body,
    signal,
  });

  const response = await result.json();

  return response as Res;
}

export class Upload {
  constructor(private readonly api: Api) {}

  private getStreamFromSource = async (source: FileSource): Promise<UploadFile> => {
    if (typeof source === 'string') {
      const stat = await fs.promises.stat(source);
      const fileName = path.basename(source);

      if (!stat.isFile()) {
        throw new Error(`Failed to upload ${fileName}. Not a file`);
      }

      const stream = fs.createReadStream(source);

      return {
        stream,
        fileName,
        contentLength: stat.size,
      };
    }

    if (source instanceof Buffer) {
      return {
        buffer: source,
        fileName: randomUUID(),
      };
    }

    const stat = await fs.promises.stat(source.path);

    let fileName: undefined | string;

    if (typeof source.path === 'string') {
      fileName = path.basename(source.path);
    } else {
      fileName = randomUUID();
    }

    return {
      stream: source,
      contentLength: stat.size,
      fileName,
    };
  };

  private upload = async <Res>(type: UploadType, file: UploadFile, options?: DefaultOptions) => {
    const res = await this.api.raw.uploads.getUploadUrl({ type });
    const { url: uploadUrl, token } = res;

    const uploadController = new AbortController();

    const uploadInterval = setTimeout(() => {
      uploadController.abort();
    }, options?.timeout || DEFAULT_UPLOAD_TIMEOUT);

    try {
      if ('stream' in file) {
        return await this.uploadFromStream<Res>({
          file,
          uploadUrl,
          abortController: uploadController,
          token,
        });
      }

      return await this.uploadFromBuffer<Res>({
        file,
        uploadUrl,
        abortController: uploadController,
        token,
      });
    } finally {
      clearTimeout(uploadInterval);
    }
  };

  private uploadFromStream = async <Res>({
    file, uploadUrl, token, abortController,
  }: {
    file: FileStream,
    uploadUrl: string,
    abortController?: AbortController,
    token?: string
  }): Promise<Res> => {
    if (token) {
      await uploadRange({ file, uploadUrl }, abortController);

      return {
        token,
        file,
        uploadUrl,
        abortController,
      } as Res;
    }
    return uploadMultipart<Res>({ file, uploadUrl }, abortController);
  };

  private uploadFromBuffer = async <Res>({ file, uploadUrl, abortController }: {
    file: FileBuffer,
    uploadUrl: string,
    abortController?: AbortController,
    token?: string,
  }): Promise<Res> => {
    const formData = new FormData();
    formData.append('data', new Blob([file.buffer]), file.fileName);

    const res = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
      signal: abortController?.signal,
    });

    return await res.json() as Res;
  };

  image = async ({ timeout, ...source }: UploadImageOptions) => {
    if ('url' in source) {
      return { url: source.url };
    }

    const fileBlob = await this.getStreamFromSource(source.source);

    return this.upload<{
      photos: { [key: string]: { token: string } }
    }>('image', fileBlob, { timeout });
  };

  video = async ({ source, ...options }: UploadVideoOptions) => {
    const fileBlob = await this.getStreamFromSource(source);

    return this.upload<{
      id: number,
      token: string,
    }>('video', fileBlob, options);
  };

  file = async ({ source, ...options }: UploadFileOptions) => {
    const fileBlob = await this.getStreamFromSource(source);

    return this.upload<{
      id: number,
      token: string,
    }>('file', fileBlob, options);
  };

  audio = async ({ source, ...options }: UploadAudioOptions) => {
    const fileBlob = await this.getStreamFromSource(source);

    return this.upload<{
      id: number,
      token: string,
    }>('audio', fileBlob, options);
  };
}
