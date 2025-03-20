import type { Client } from './client';
import {
  BaseApi, BotsApi, ChatsApi, MessagesApi, SubscriptionsApi, UploadsApi,
} from './modules';

export class RawApi extends BaseApi {
  constructor(private readonly client: Client) {
    super(client);
  }

  public get = this._get;

  public post = this._post;

  public patch = this._patch;

  private _chats?: ChatsApi;

  get chats() {
    return (this._chats ??= new ChatsApi(this.client));
  }

  private _bots?: BotsApi;

  get bots() {
    return (this._bots ??= new BotsApi(this.client));
  }

  private _messages?: MessagesApi;

  get messages() {
    return (this._messages ??= new MessagesApi(this.client));
  }

  private _subscriptions?: SubscriptionsApi;

  get subscriptions() {
    return (this._subscriptions ??= new SubscriptionsApi(this.client));
  }

  private _uploads?: UploadsApi;

  get uploads() {
    return (this._uploads ??= new UploadsApi(this.client));
  }
}
