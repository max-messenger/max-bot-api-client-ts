import * as fs from 'fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { type Api } from '../../../api';
import type { UploadType } from '../../network/api';
import { DEFAULT_UPLOAD_TIMEOUT } from '../../../shared/model/config';
import { XhrClient } from '../../network/xhr';
import type { XhrProgressEvent } from '../../network/xhr';
import {
  DefaultOptions,
  FileSource,
  UploadAudioOptions,
  UploadFile,
  UploadFileOptions,
  UploadFromBufferParams,
  UploadFromStreamParams,
  UploadImageOptions,
  UploadProgressCallback,
  UploadRangeChunkParams,
  UploadRequestOptions,
  UploadStreamParams,
  UploadVideoOptions,
} from './types';

export class Upload {
  xhrClient: XhrClient;

  constructor(private readonly api: Api) {
    this.xhrClient = new XhrClient();
  }

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

  private upload = async <Res>(type: UploadType, file: UploadFile, options?: DefaultOptions) => {
    const res = await this.api.raw.uploads.getUploadUrl({ type });
    const { url: uploadUrl, token } = res;

    const uploadController = new AbortController();

    const uploadAbortTimeout = setTimeout(() => {
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
      clearTimeout(uploadAbortTimeout);
    }
  };

  private uploadFromStream = async <Res>({
    file, uploadUrl, token, abortController, onUploadProgress,
  }: UploadFromStreamParams): Promise<Res> => {
    if (token) {
      await this.uploadRange(
        { file, uploadUrl, onUploadProgress },
        { signal: abortController?.signal },
      );

      return {
        token,
        file,
        uploadUrl,
        abortController,
      } as Res;
    }

    return this.uploadMultipart<Res>(
      { file, uploadUrl, onUploadProgress },
      { signal: abortController?.signal },
    );
  };

  private uploadFromBuffer = async <Res>({
    file, uploadUrl, abortController, onUploadProgress,
  }: UploadFromBufferParams): Promise<Res> => {
    const formData = new FormData();
    formData.append('data', new Blob([file.buffer]), file.fileName);

    const result = await this.xhrClient.post<Res>(uploadUrl, formData, {
      signal: abortController?.signal,
      onUploadProgress,
    });

    return result.data as Res;
  };

  /**
   * Загрузить файл через Multipart запрос
   */
  private uploadMultipart = async <Res>(
    { uploadUrl, file, onUploadProgress }: UploadStreamParams,
    options: UploadRequestOptions = {},
  ) => {
    const body = new FormData();
    body.append('data', {
      [Symbol.toStringTag]: 'File',
      name: file.fileName,
      stream: () => file.stream,
      size: file.contentLength,
    } as unknown as File);

    const result = await this.xhrClient.post<Res>(
      uploadUrl,
      body,
      { onUploadProgress, signal: options.signal, responseType: 'json' },
    );

    return result.data as Res;
  };

  /**
   * Загрузить чанк данных через Content-Range запрос
   */
  private uploadRangeChunk = async (
    {
      uploadUrl, chunk, startByte, endByte, fileSize, fileName, onUploadProgress,
    }: UploadRangeChunkParams,
    options: UploadRequestOptions = {},
  ) => {
    const result = await this.xhrClient.post<string>(uploadUrl, chunk, {
      responseType: 'text',
      signal: options.signal,
      onUploadProgress,
      headers: {
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Range': `bytes ${startByte}-${endByte}/${fileSize}`,
        'Content-Type': 'application/x-binary; charset=x-user-defined',
        'X-File-Name': fileName,
        'X-Uploading-Mode': 'parallel',
        Connection: 'keep-alive',
      },
    });

    return result.data;
  };

  /**
   * Хелпер для агрегации прогресса отдельных чанков в прогресс всего файла
   */
  private createProgressHandler = (
    size: number,
    progressContext: { totalUploadedBefore: number },
    onUploadProgress?: UploadProgressCallback,
  ) => {
    if (!onUploadProgress) return undefined;

    return (chunkEvent: XhrProgressEvent) => {
      const totalLoaded = Math.min(progressContext.totalUploadedBefore + chunkEvent.loaded, size);
      const ratio = size > 0 ? totalLoaded / size : 0;
      const percent = Math.min(Math.round(ratio * 100), 100);

      onUploadProgress({
        ratio,
        loaded: totalLoaded,
        total: size,
        percent,
      });
    };
  };

  /**
   * Загрузить файл через Content-Range запрос
   */
  private uploadRange = async (
    { uploadUrl, file }: UploadStreamParams,
    options: UploadRequestOptions = {},
  ) => {
    const size = file.contentLength;
    let startByte = 0;
    let endByte = 0;

    const progressContext = { totalUploadedBefore: 0 };

    const handleChunkProgress = this.createProgressHandler(
      size,
      progressContext,
      options.onUploadProgress,
    );

    for await (const chunk of file.stream) {
      endByte = startByte + chunk.length - 1;
      const currentChunkLength = chunk.length;

      await this.uploadRangeChunk(
        {
          uploadUrl,
          startByte,
          endByte,
          chunk,
          fileName: file.fileName,
          fileSize: size,
          onUploadProgress: handleChunkProgress,
        },
        {
          signal: options.signal,
        },
      );

      progressContext.totalUploadedBefore += currentChunkLength;
      startByte = endByte + 1;
    }
  };
}
