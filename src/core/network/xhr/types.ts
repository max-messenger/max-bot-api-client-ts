export type XhrHTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type XhrBody =
  | string
  | ArrayBuffer
  | ArrayBufferView
  | Blob
  | Document
  | FormData
  | URLSearchParams
  | Record<string, unknown>
  | null;

export type XhrProgressEvent = {
  /**
   * Доля завершённой работы от 0 до 1
   */
  ratio: number;
  /**
   * Загружено байт
   */
  loaded: number;
  /**
   * Общий размер в байтах (0, если неизвестен)
   */
  total: number;
  /**
   * Доля завершённой работы в процентах от 0 до 100
   */
  percent: number;
};

export type XhrRequestOptions = {
  /**
   * HTTP-метод, по умолчанию GET
   */
  method?: XhrHTTPMethod;
  /**
   * Путь или полный URL запроса
   */
  url: string;
  /**
   * Query-параметры
   */
  query?: Record<string, string | number | boolean | null | undefined>;
  /**
   * Заголовки запроса
   */
  headers?: Record<string, string>;
  /**
   * Тело запроса
   */
  body?: XhrBody;
  /**
   * Таймаут в миллисекундах
   */
  timeout?: number;
  /**
   * Тип ожидаемого ответа
   */
  responseType?: XMLHttpRequestResponseType;
  /**
   * MIME-тип, переопределяющий ответ сервера
   */
  overrideMimeType?: string;
  /**
   * Прогресс загрузки ответа (download)
   */
  onDownloadProgress?: (event: XhrProgressEvent) => void;
  /**
   * Прогресс отправки тела запроса (upload)
   */
  onUploadProgress?: (event: XhrProgressEvent) => void;
  /**
   * Внешний сигнал для отмены запроса
   */
  signal?: AbortSignal;
};

export type XhrResponse<T = unknown> = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: T;
};
