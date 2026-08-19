import { randomUUID } from 'node:crypto';
import path from 'node:path';
import FormDataStream from 'form-data';

import fs from 'node:fs';
import { type Api } from '../../../api';
import {
  StreamUploadClient,
  type UploadType,
  type StreamUploadEvent,
  type StreamUploadProgressCallback,
} from '../../network/api';
import type {
  FileSource,
  UploadFile,
  DefaultOptions,
  FileUploadResult,
  AudioUploadResult,
  VideoUploadResult,
  ImageUploadResult,
  UploadFileOptions,
  UploadVideoOptions,
  UploadStreamParams,
  UploadImageOptions,
  UploadAudioOptions,
  UploadRequestOptions,
  UploadFromBufferParams,
  UploadFromStreamParams,
  UploadRangeChunkParams,
  UploadProgressContext,
} from './types';

const DEFAULT_UPLOAD_TIMEOUT = 20_000; // ms
const CHUNK_UPLOAD_THROTTLE = 500; // ms

export class Upload {
  private readonly streamUploadClient: StreamUploadClient;

  constructor(private readonly api: Api) {
    this.streamUploadClient = new StreamUploadClient();
  }

  private getStreamFromSource = async (source: FileSource): Promise<UploadFile> => {
    if (typeof source === 'string') {
      const stat = await fs.promises.stat(source);
      const fileName = path.basename(source);

      if (!stat.isFile()) {
        throw new Error(`Failed to upload ${fileName}. Not a file`);
      }

      const stream = fs.createReadStream(source);

      return { stream, fileName, contentLength: stat.size };
    }

    if (Buffer.isBuffer(source)) {
      return { buffer: source, fileName: randomUUID() };
    }

    const stat = await fs.promises.stat(source.path);
    const fileName = typeof source.path === 'string' ? path.basename(source.path) : randomUUID();

    return {
      stream: source,
      contentLength: stat.size,
      fileName,
    };
  };

  image = async ({ timeout, onUploadProgress, ...source }: UploadImageOptions) => {
    if ('url' in source) return { url: source.url };

    const fileBlob = await this.getStreamFromSource(source.source);
    return this.upload<ImageUploadResult>('image', fileBlob, { timeout, onUploadProgress });
  };

  video = async ({ source, ...options }: UploadVideoOptions) => {
    const fileBlob = await this.getStreamFromSource(source);
    return this.upload<VideoUploadResult>('video', fileBlob, options);
  };

  file = async ({ source, ...options }: UploadFileOptions) => {
    const fileBlob = await this.getStreamFromSource(source);
    return this.upload<FileUploadResult>('file', fileBlob, options);
  };

  audio = async ({ source, ...options }: UploadAudioOptions) => {
    const fileBlob = await this.getStreamFromSource(source);
    return this.upload<AudioUploadResult>('audio', fileBlob, options);
  };

  private upload = async <Res>(
    type: UploadType,
    file: UploadFile,
    options?: DefaultOptions,
  ) => {
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
          token,
          uploadUrl,
          abortController: uploadController,
          onUploadProgress: options?.onUploadProgress,
        });
      }

      return await this.uploadFromBuffer<Res>({
        file,
        token,
        uploadUrl,
        abortController: uploadController,
        onUploadProgress: options?.onUploadProgress,
      });
    } finally {
      clearTimeout(uploadAbortTimeout);
    }
  };

  private uploadFromStream = async <Res>({
    file,
    token,
    uploadUrl,
    abortController,
    onUploadProgress,
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
    file,
    uploadUrl,
    abortController,
    onUploadProgress,
  }: UploadFromBufferParams): Promise<Res> => {
    const formData = new FormDataStream();
    formData.append('data', file.buffer, file.fileName);

    const result = await this.streamUploadClient.post<Res>(uploadUrl, formData, {
      signal: abortController?.signal,
      onUploadProgress,
    });

    return result.data as Res;
  };

  private uploadMultipart = async <Res>(
    { uploadUrl, file, onUploadProgress }: UploadStreamParams,
    options: UploadRequestOptions = {},
  ) => {
    const body = new FormDataStream();

    body.append('data', file.stream, {
      filename: file.fileName,
      knownLength: file.contentLength,
    });

    const result = await this.streamUploadClient.post<Res>(
      uploadUrl,
      body,
      { onUploadProgress, signal: options.signal, responseType: 'json' },
    );

    return result.data as Res;
  };

  private uploadRangeChunk = async (
    {
      uploadUrl, chunk, startByte, endByte, fileSize, fileName, onUploadProgress,
    }: UploadRangeChunkParams,
    options: UploadRequestOptions = {},
  ) => {
    const result = await this.streamUploadClient.post<string>(uploadUrl, chunk, {
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

  private createProgressHandler = (
    size: number,
    progressContext: UploadProgressContext,
    onUploadProgress?: StreamUploadProgressCallback,
  ) => {
    if (!onUploadProgress) return undefined;

    let lastPercent = -1;
    let lastTime = 0;

    return (chunkEvent: StreamUploadEvent) => {
      const totalLoaded = Math.min(progressContext.totalUploadedBefore + chunkEvent.loaded, size);
      const ratio = size > 0 ? totalLoaded / size : 0;
      const percent = Math.min(Math.round(ratio * 100), 100);

      const now = Date.now();

      const isThrottleTimePassed = now - lastTime >= CHUNK_UPLOAD_THROTTLE;
      const isFinished = percent === 100;

      if (percent !== lastPercent && (isThrottleTimePassed || isFinished)) {
        lastPercent = percent;
        lastTime = now;

        onUploadProgress({
          ratio,
          loaded: totalLoaded,
          total: size,
          percent,
        });
      }
    };
  };

  private uploadRange = async (
    { uploadUrl, file, onUploadProgress }: UploadStreamParams,
    options: UploadRequestOptions = {},
  ) => {
    const size = file.contentLength;
    let startByte = 0;
    let endByte = 0;

    const progressContext = { totalUploadedBefore: 0 };
    const handleChunkProgress = this.createProgressHandler(
      size,
      progressContext,
      onUploadProgress,
    );

    for await (const chunk of file.stream) {
      endByte = startByte + chunk.length - 1;
      const currentChunkLength = chunk.length;

      await this.uploadRangeChunk({
        uploadUrl,
        startByte,
        endByte,
        chunk,
        fileName: file.fileName,
        fileSize: size,
        onUploadProgress: handleChunkProgress,
      }, { signal: options.signal });

      progressContext.totalUploadedBefore += currentChunkLength;
      startByte = endByte + 1;
    }
  };
}
