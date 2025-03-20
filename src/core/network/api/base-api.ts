import type { Client, ReqOptions } from './client';
import { MaxError } from './error';

import type { ApiMethods } from './modules/types';

type ApiCallFn<HTTPMethod extends keyof ApiMethods> = <Method extends keyof ApiMethods[HTTPMethod]>(
  method: Method,
  // @ts-ignore
  options: ApiMethods[HTTPMethod][Method]['req']
  // @ts-ignore
) => Promise<ApiMethods[HTTPMethod][Method]['res']>;

export class BaseApi {
  private readonly call: Client['call'];

  constructor(client: Client) {
    this.call = client.call;
  }

  private callApi = async (method: string, options: ReqOptions) => {
    const result = await this.call({
      method,
      options,
    });
    if (result.status !== 200) {
      throw new MaxError(result.status, result.data);
    }
    return result.data;
  };

  protected _get: ApiCallFn<'GET'> = async (method, options) => {
    return this.callApi(method, { ...options, method: 'GET' });
  };

  protected _post: ApiCallFn<'POST'> = async (method, options) => {
    return this.callApi(method, { ...options, method: 'POST' });
  };

  protected _patch: ApiCallFn<'PATCH'> = async (method, options) => {
    return this.callApi(method, { ...options, method: 'PATCH' });
  };

  protected _put: ApiCallFn<'PUT'> = async (method, options) => {
    return this.callApi(method, { ...options, method: 'PUT' });
  };

  protected _delete: ApiCallFn<'DELETE'> = async (method, options) => {
    return this.callApi(method, { ...options, method: 'DELETE' });
  };
}
