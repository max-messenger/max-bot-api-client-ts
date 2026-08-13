import {
  XhrBody, XhrProgressEvent, XhrRequestOptions, XhrResponse,
} from './types';
import { XhrError } from './error';
import { DEFAULT_UPLOAD_TIMEOUT } from '../../../shared/model/config';

const toProgressEvent = (event: ProgressEvent): XhrProgressEvent => {
  const total = event.lengthComputable ? event.total : 0;
  const safeTotal = total > 0 ? total : event.total || 0;

  return {
    loaded: event.loaded,
    total,
    ratio: safeTotal > 0 ? event.loaded / safeTotal : 0,
    percent: safeTotal > 0 ? Math.round((event.loaded / safeTotal) * 100) : 0,
  };
};

type SerializedResult = { data: XMLHttpRequestBodyInit | null; isJson: boolean };

const serializeBody = (body?: XhrBody): SerializedResult => {
  if (body === null || body === undefined) {
    return { data: null, isJson: false };
  }

  const isDirect = typeof body === 'string'
    || body instanceof FormData
    || body instanceof URLSearchParams
    || body instanceof Blob
    || body instanceof ArrayBuffer
    || ArrayBuffer.isView(body);

  if (isDirect) {
    return { data: body, isJson: false };
  }

  return { data: JSON.stringify(body), isJson: true };
};

const resolveUrl = (url: string, query?: XhrRequestOptions['query']): string => {
  const urlObj = new URL(url);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    urlObj.searchParams.set(key, String(value));
  });
  return urlObj.href;
};

const parseHeaders = (rawHeaders: string): Record<string, string> => {
  const headers: Record<string, string> = {};

  if (!rawHeaders) return headers;

  rawHeaders
    .trim()
    .split(/[\r\n]+/)
    .forEach((line) => {
      const index = line.indexOf(':');
      if (index === -1) return;

      const key = line.slice(0, index).trim().toLowerCase();
      const value = line.slice(index + 1).trim();

      if (!key) return;

      if (headers[key]) {
        headers[key] = `${headers[key]}, ${value}`;
      } else {
        headers[key] = value;
      }
    });

  return headers;
};

export class XhrClient {
  constructor(private readonly defaultOptions: Omit<XhrRequestOptions, 'url'> = {}) {}

  private request<T = unknown>(options: XhrRequestOptions): Promise<XhrResponse<T>> {
    const merged = { ...this.defaultOptions, ...options };

    return new Promise<XhrResponse<T>>((resolve, reject) => {
      const {
        method = 'GET',
        url,
        query,
        headers,
        body,
        timeout = DEFAULT_UPLOAD_TIMEOUT,
        responseType = '',
        overrideMimeType,
        onDownloadProgress,
        onUploadProgress,
        signal,
      } = merged;

      const xhr = new XMLHttpRequest();
      const fullUrl = resolveUrl(url, query);

      xhr.open(method, fullUrl, true);
      xhr.responseType = responseType;
      xhr.timeout = timeout;

      if (overrideMimeType) {
        xhr.overrideMimeType(overrideMimeType);
      }

      const { data, isJson } = serializeBody(body);

      let hasContentType = false;

      Object.entries(headers ?? {}).forEach(([key, value]) => {
        const lowerKey = key.toLowerCase();

        if (lowerKey === 'content-type') {
          hasContentType = true;
        }

        xhr.setRequestHeader(key, value);
      });

      if (isJson && !hasContentType) {
        xhr.setRequestHeader('Content-Type', 'application/json');
      }

      if (onDownloadProgress) {
        xhr.addEventListener('progress', (event) => {
          onDownloadProgress(toProgressEvent(event));
        });
      }

      if (onUploadProgress && xhr.upload) {
        xhr.upload.addEventListener('progress', (event) => {
          onUploadProgress(toProgressEvent(event));
        });
      }

      const handleAbort = () => xhr.abort();

      if (signal) {
        if (signal.aborted) {
          handleAbort();
        } else {
          signal.addEventListener('abort', handleAbort, { once: true });
        }
      }

      const cleanup = () => {
        signal?.removeEventListener('abort', handleAbort);
      };

      xhr.addEventListener('load', () => {
        const responseHeaders = parseHeaders(xhr.getAllResponseHeaders());

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({
            status: xhr.status,
            statusText: xhr.statusText,
            headers: responseHeaders,
            data: xhr.response as T,
          });
          return;
        }

        reject(new XhrError(xhr.status, xhr.statusText, xhr.response));
      });

      xhr.addEventListener('error', () => {
        reject(new XhrError(xhr.status, 'Network error', undefined, 'network'));
      });

      xhr.addEventListener('abort', () => {
        reject(new XhrError(0, 'Request aborted', undefined, 'abort'));
      });

      xhr.addEventListener('timeout', () => {
        reject(new XhrError(0, 'Request timeout', undefined, 'timeout'));
      });

      xhr.addEventListener('loadend', cleanup);

      xhr.send(data);
    });
  }

  get<T = unknown>(url: string, options?: Omit<XhrRequestOptions, 'url' | 'method' | 'body'>): Promise<XhrResponse<T>> {
    return this.request<T>({ ...options, url, method: 'GET' });
  }

  post<T = unknown>(url: string, body: XhrBody, options?: Omit<XhrRequestOptions, 'url' | 'method' | 'body'>): Promise<XhrResponse<T>> {
    return this.request<T>({
      ...options, url, method: 'POST', body,
    });
  }

  put<T = unknown>(url: string, body: XhrBody, options?: Omit<XhrRequestOptions, 'url' | 'method' | 'body'>): Promise<XhrResponse<T>> {
    return this.request<T>({
      ...options, url, method: 'PUT', body,
    });
  }

  patch<T = unknown>(url: string, body: XhrBody, options?: Omit<XhrRequestOptions, 'url' | 'method' | 'body'>): Promise<XhrResponse<T>> {
    return this.request<T>({
      ...options, url, method: 'PATCH', body,
    });
  }

  delete<T = unknown>(url: string, options?: Omit<XhrRequestOptions, 'url' | 'method' | 'body'>): Promise<XhrResponse<T>> {
    return this.request<T>({ ...options, url, method: 'DELETE' });
  }
}
