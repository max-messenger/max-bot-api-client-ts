import { Readable } from 'node:stream';
import FormDataStream from 'form-data';

import https from 'node:https';
import http from 'node:http';
import { StreamUploadOptions } from './types';
import { MaxError } from './error';

const CLIENT_CLOSED_REQUEST_STATUS = 499;
const ERROR_STATUS_THRESHOLD = 400;
const HTTPS_PORT = 443;
const HTTP_PORT = 80;

export class StreamUploadClient {
  public async post<T>(
    url: string,
    body: FormDataStream | string | Buffer,
    options: StreamUploadOptions = {},
    token?: string,
  ): Promise<{ data: T }> {
    const urlObj = new URL(url);
    const isSecure = urlObj.protocol === 'https:';

    const customHeaders = Object.entries(
      options.headers ?? {},
    ).reduce<Record<string, string>>((acc, [k, v]) => {
      acc[k.toLowerCase()] = v;
      return acc;
    }, {});

    let uploadStream: Readable;
    let totalSize = 0;

    if (body instanceof FormDataStream) {
      customHeaders['content-type'] = body.getHeaders()['content-type'];

      totalSize = await new Promise<number>((resolve, reject) => {
        body.getLength((err, length) => (err ? reject(
          new MaxError(CLIENT_CLOSED_REQUEST_STATUS, {
            message: 'Failed to calculate FormData length',
            code: 'upload.length.error',
          }),
        ) : resolve(length)));
      });

      uploadStream = body;
    } else {
      const payload = typeof body === 'string' ? Buffer.from(body, 'utf-8') : body;
      totalSize = payload.length;
      uploadStream = Readable.from(payload);
    }

    if (totalSize > 0 && !customHeaders['content-length']) {
      customHeaders['content-length'] = String(totalSize);
    }

    return new Promise((resolve, reject) => {
      const defaultPort = isSecure ? HTTPS_PORT : HTTP_PORT;

      const reqOptions: https.RequestOptions = {
        method: 'POST',
        hostname: urlObj.hostname,
        port: urlObj.port || defaultPort,
        path: `${urlObj.pathname}${urlObj.search}`,
        headers: customHeaders,
        signal: options.signal,
      };

      const transport = isSecure ? https : http;

      const req = transport.request(reqOptions, (res) => {
        let responseData = '';
        const statusCode = res.statusCode || 0;

        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
          if (statusCode >= ERROR_STATUS_THRESHOLD) {
            let errorBody;
            try {
              errorBody = JSON.parse(responseData);
            } catch {
              errorBody = { message: responseData };
            }
            reject(new MaxError(statusCode, errorBody));
            return;
          }

          try {
            // Тип текст возвращается при загрузке потока чанками
            resolve({ data: (options.responseType === 'text' ? responseData : JSON.parse(responseData)) as T });
          } catch {
            // Необходимо для обработки успешной загрузки видео,
            // тк Bot Api возвращает <retval>1</retval>
            resolve({ data: { token } as T });
          }
        });
      });

      req.on('error', (err) => {
        if (err.name === 'AbortError' || options.signal?.aborted) {
          reject(new MaxError(CLIENT_CLOSED_REQUEST_STATUS, {
            message: 'Request aborted by user or timeout',
            code: 'upload.request.aborted',
          }));
          return;
        }

        reject(new MaxError(CLIENT_CLOSED_REQUEST_STATUS, {
          message: 'Network error',
          code: 'upload.request.error',
        }));
      });

      if (options.onUploadProgress && totalSize > 0) {
        let loadedBytes = 0;

        uploadStream.on('data', (chunk: Buffer) => {
          loadedBytes += chunk.length;
          const ratio = loadedBytes / totalSize;
          options.onUploadProgress?.({
            ratio,
            loaded: loadedBytes,
            total: totalSize,
            percent: Math.min(Math.round(ratio * 100), 100),
          });
        });
      }

      uploadStream.on('end', () => {
        req.end();
      });

      uploadStream.on('error', (err) => {
        req.destroy(err);
        reject(new MaxError(CLIENT_CLOSED_REQUEST_STATUS, {
          message: 'Upload stream error',
          code: 'upload.stream.error',
        }));
      });

      uploadStream.pipe(req);
    });
  }
}
