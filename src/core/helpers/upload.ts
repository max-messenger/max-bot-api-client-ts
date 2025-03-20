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
    const { url: uploadUrl } = await this.api.raw.uploads.getUploadUrl({ type });

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
        });
      }

      return await this.uploadFromBuffer<Res>({
        file,
        uploadUrl,
        abortController: uploadController,
      });
    } finally {
      clearTimeout(uploadInterval);
    }
  };

  private uploadFromStream = async <Res>({ file, uploadUrl, abortController }: {
    file: FileStream,
    uploadUrl: string,
    abortController?: AbortController,
  }): Promise<Res> => {
    return new Promise((resolve, reject) => {
      let prevChunk = -1;
      let uploadData: Res | null = null;

      file.stream.on('data', async (chunk) => {
        file.stream.pause();

        const startBite = prevChunk + 1;
        const endBite = prevChunk + chunk.length;

        const uploadRes = await fetch(uploadUrl, {
          method: 'POST',
          body: chunk,
          headers: {
            'Content-Disposition': `attachment; filename="${file.fileName}"`,
            'Content-Range': `bytes ${startBite}-${endBite}/${file.contentLength}`,
          },
          signal: abortController?.signal,
        });

        if (uploadRes.status >= 400) {
          const error = await uploadRes.json();
          throw new MaxError(uploadRes.status, error);
        }

        if (!uploadData) {
          uploadData = await uploadRes.json();
        }

        file.stream.resume();

        prevChunk += chunk.length;
      });
      file.stream.on('end', async () => {
        if (!uploadData) {
          reject(new Error('Failed to upload'));
          return;
        }
        resolve(uploadData);
      });
      file.stream.on('error', (err) => {
        reject(err);
      });
    });
  };

  private uploadFromBuffer = async <Res>({ file, uploadUrl, abortController }: {
    file: FileBuffer,
    uploadUrl: string,
    abortController?: AbortController,
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
