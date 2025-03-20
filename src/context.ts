import vCard from 'vcf';
import type { Guard, Guarded, MaybeArray } from './core/helpers/types';
import type {
  AnswerOnCallbackExtra, BotInfo, BotStartedUpdate, Chat,
  EditMessageExtra, FilteredUpdate, GetMessagesExtra, Message,
  MessageCallbackUpdate, SenderAction, SendMessageExtra,
  Update, UpdateType, User,
} from './core/network/api';

import { type Api } from './api';
import {
  EditChatExtra,
  GetAllChatsExtra,
  GetChatMembersExtra,
  PinMessageExtra,
} from './core/network/api/modules';

export type FilteredContext<
  Ctx extends Context,
  Filter extends UpdateType | Guard<Ctx['update']>,
> = Filter extends UpdateType
  ? Ctx & Context<FilteredUpdate<Filter>>
  : Ctx & Context<Guarded<Filter>>;

type GetMessage<U extends Update> =
  | U extends MessageCallbackUpdate
    ? MessageCallbackUpdate['message']
    : U extends { message: Message }
      ? Message
      : undefined;

type GetChatId<U extends Update> =
    | U extends { chat_id: number }
      ? number
      : U extends MessageCallbackUpdate
        ? number | undefined
        : U extends { message: Message }
          ? number
          : undefined;

type GetChat<U extends Update> =
    | U extends { chat: Chat }
      ? Chat
      : undefined;

type GetMsgId<U extends Update> =
    | U extends { message_id: string }
      ? string
      : U extends MessageCallbackUpdate
        ? string | undefined
        : U extends { message: Message }
          ? string
          : undefined;

type GetCallback<U extends Update> =
    | U extends MessageCallbackUpdate
      ? MessageCallbackUpdate['callback']
      : undefined;

type GetUser<U extends Update> =
    | U extends { user: User }
      ? User
      : U extends MessageCallbackUpdate
        ? User
        : undefined;

type GetStartPayload<U extends Update> =
    | U extends BotStartedUpdate
      ? string | undefined | null
      : undefined;

type ContactInfo = {
  tel?: string,
  fullName?: string,
};

type Location = {
  latitude: number
  longitude: number
};

type Sticker = {
  width: number;
  height: number;
  url: string;
  code: string;
};

export class Context<U extends Update = Update> {
  match?: RegExpExecArray;

  constructor(
    readonly update: U,
    readonly api: Api,
    readonly botInfo?: BotInfo,
  ) {}

  has<Ctx extends Context, Filter extends UpdateType | Guard<Ctx['update']>>(
    this: Ctx,
    filters: MaybeArray<Filter>,
  ): this is FilteredContext<Ctx, Filter> {
    for (const filter of Array.isArray(filters) ? filters : [filters]) {
      if (typeof filter === 'function'
        ? filter(this.update)
        : filter === this.update.update_type
      ) {
        return true;
      }
    }

    return false;
  }

  assert<T extends string | number | object>(
    value: T | undefined,
    method: string,
  ): asserts value is T {
    if (value === undefined) {
      throw new TypeError(
        `Max: "${method}" isn't available for "${this.updateType}"`,
      );
    }
  }

  get updateType() {
    return this.update.update_type;
  }

  get myId() {
    return this.botInfo?.user_id;
  }

  get startPayload() {
    return getStartPayload(this.update) as GetStartPayload<U>;
  }

  get chat() {
    return getChat(this.update) as GetChat<U>;
  }

  get chatId() {
    return getChatId(this.update) as GetChatId<U>;
  }

  get message() {
    return getMessage(this.update) as GetMessage<U>;
  }

  get messageId() {
    return getMessageId(this.update) as GetMsgId<U>;
  }

  get callback() {
    return getCallback(this.update) as GetCallback<U>;
  }

  get user() {
    return getUser(this.update) as GetUser<U>;
  }

  private _contactInfo?: ContactInfo;

  get contactInfo() {
    return (this._contactInfo ??= getContactInfo(this.update));
  }

  private _location?: Location;

  get location() {
    return (this._location ??= getLocation(this.update));
  }

  private _sticker?: Sticker;

  get sticker() {
    return (this._sticker ??= getSticker(this.update));
  }

  async reply(text: string, extra?: SendMessageExtra) {
    this.assert(this.chatId, 'reply');
    return this.api.sendMessageToChat(this.chatId, text, extra);
  }

  async getAllChats(extra?: GetAllChatsExtra) {
    return this.api.getAllChats(extra);
  }

  async getChat(chatId?: number) {
    if (chatId !== undefined) {
      return this.api.getChat(chatId);
    }
    this.assert(this.chatId, 'getChat');
    return this.api.getChat(this.chatId);
  }

  async getChatByLink(link: string) {
    return this.api.getChatByLink(link);
  }

  async editChatInfo(extra: EditChatExtra) {
    this.assert(this.chatId, 'editChatInfo');
    return this.api.editChatInfo(this.chatId, extra);
  }

  async getMessage(id: string) {
    return this.api.getMessage(id);
  }

  async getMessages(extra?: GetMessagesExtra) {
    this.assert(this.chatId, 'getMessages');
    return this.api.getMessages(this.chatId, extra);
  }

  async getPinnedMessage() {
    this.assert(this.chatId, 'getPinnedMessage');
    return this.api.getPinnedMessage(this.chatId);
  }

  async editMessage(extra: EditMessageExtra) {
    this.assert(this.messageId, 'editMessage');
    return this.api.editMessage(this.messageId, extra);
  }

  async deleteMessage(messageId?: string) {
    if (messageId !== undefined) {
      return this.api.deleteMessage(messageId);
    }
    this.assert(this.messageId, 'deleteMessage');
    return this.api.deleteMessage(this.messageId);
  }

  async answerOnCallback(extra: AnswerOnCallbackExtra) {
    this.assert(this.callback, 'answerOnCallback');
    return this.api.answerOnCallback(this.callback.callback_id, extra);
  }

  async getChatMembership() {
    this.assert(this.chatId, 'getChatMembership');
    return this.api.getChatMembership(this.chatId);
  }

  async getChatAdmins() {
    this.assert(this.chatId, 'getChatAdmins');
    return this.api.getChatAdmins(this.chatId);
  }

  async addChatMembers(userIds: number[]) {
    this.assert(this.chatId, 'addChatMembers');
    return this.api.addChatMembers(this.chatId, userIds);
  }

  async getChatMembers(extra?: GetChatMembersExtra) {
    this.assert(this.chatId, 'getChatMembers');
    return this.api.getChatMembers(this.chatId, extra);
  }

  async removeChatMember(userId: number) {
    this.assert(this.chatId, 'removeChatMember');
    return this.api.removeChatMember(this.chatId, userId);
  }

  async pinMessage(messageId: string, extra?: PinMessageExtra) {
    this.assert(this.chatId, 'pinMessage');
    return this.api.pinMessage(this.chatId, messageId, extra);
  }

  async unpinMessage() {
    this.assert(this.chatId, 'unpinMessage');
    return this.api.unpinMessage(this.chatId);
  }

  async sendAction(action: SenderAction) {
    this.assert(this.chatId, 'sendAction');
    return this.api.sendAction(this.chatId, action);
  }

  async leaveChat() {
    this.assert(this.chatId, 'leaveChat');
    return this.api.leaveChat(this.chatId);
  }
}

const getChatId = (update: Update) => {
  if ('chat_id' in update) {
    return update.chat_id;
  }
  if ('message' in update && update.message && 'recipient' in update.message) {
    return update.message.recipient.chat_id;
  }

  if ('chat' in update) {
    return update.chat.chat_id;
  }

  return undefined;
};

const getChat = (update: Update) => {
  if ('chat' in update) {
    return update.chat;
  }

  return undefined;
};

const getMessage = (update: Update) => {
  if ('message' in update) {
    return update.message;
  }
  return undefined;
};

const getMessageId = (update: Update) => {
  if ('message_id' in update) {
    return update.message_id;
  }

  if ('message' in update) {
    return update.message?.body.mid;
  }

  return undefined;
};

const getCallback = (update: Update) => {
  if ('callback' in update) {
    return update.callback;
  }
  return undefined;
};

const getContactInfo = (update: Update): ContactInfo | undefined => {
  const message = getMessage(update);
  if (!message) return undefined;
  const contact = message.body.attachments?.find((attachment) => {
    return attachment.type === 'contact';
  });
  if (!contact?.payload.vcf_info) return undefined;
  // eslint-disable-next-line new-cap
  const vcf = new vCard().parse(contact.payload.vcf_info);
  return {
    tel: vcf.get('tel').valueOf() as string | undefined,
    fullName: vcf.get('fn').valueOf() as string | undefined,
  };
};

const getLocation = (update: Update): Location | undefined => {
  const message = getMessage(update);
  if (!message) return undefined;
  const location = message.body.attachments?.find((attachment) => {
    return attachment.type === 'location';
  });
  if (!location) return undefined;
  return {
    latitude: location.latitude,
    longitude: location.longitude,
  };
};

const getSticker = (update: Update): Sticker | undefined => {
  const message = getMessage(update);
  if (!message) return undefined;
  const sticker = message.body.attachments?.find((attachment) => {
    return attachment.type === 'sticker';
  });
  if (!sticker) return undefined;
  return {
    width: sticker.width,
    height: sticker.height,
    url: sticker.payload.url,
    code: sticker.payload.code,
  };
};

const getUser = (update: Update): User | undefined => {
  if ('user' in update) {
    return update.user;
  }

  if (update.update_type === 'message_callback') {
    return update.callback.user;
  }

  if (update.update_type === 'message_created') {
    return update.message.sender || undefined;
  }

  return undefined;
};

const getStartPayload = (update: Update): string | null | undefined => {
  if (update.update_type === 'bot_started') {
    return update.payload;
  }
  return undefined;
};
