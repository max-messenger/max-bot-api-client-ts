import {
  AudioAttachment,
  FileAttachment,
  ImageAttachment,
  VideoAttachment,
} from './core/helpers/attachments';
import type { MaybeArray } from './core/helpers/types';
import { Upload } from './core/helpers/upload';
import type {
  UploadFileOptions, UploadImageOptions, UploadVideoOptions, UploadAudioOptions,
} from './core/helpers/upload';

import { GetMessagesExtra, RawApi, SenderAction } from './core/network/api';

import type {
  AnswerOnCallbackExtra, Client, DeleteMessageExtra,
  EditMessageExtra, SendMessageExtra, BotCommand,
  EditMyInfoDTO, FlattenReq, GetUpdatesDTO, UpdateType,
} from './core/network/api';
import type {
  EditChatExtra,
  GetAllChatsExtra,
  GetChatMembersExtra,
  PinMessageExtra,
} from './core/network/api/modules';

export class Api {
  raw: RawApi;

  upload: Upload;

  constructor(client: Client) {
    this.raw = new RawApi(client);
    this.upload = new Upload(this);
  }

  getMyInfo = async () => {
    return this.raw.bots.getMyInfo();
  };

  editMyInfo = async (extra: FlattenReq<EditMyInfoDTO>) => {
    return this.raw.bots.editMyInfo(extra);
  };

  setMyCommands = async (commands: BotCommand[]) => {
    return this.editMyInfo({ commands });
  };

  deleteMyCommands = async () => {
    return this.editMyInfo({ commands: [] });
  };

  getAllChats = async (extra: GetAllChatsExtra = {}) => {
    return this.raw.chats.getAll(extra);
  };

  getChat = async (id: number) => {
    return this.raw.chats.getById({ chat_id: id });
  };

  getChatByLink = async (link: string) => {
    return this.raw.chats.getByLink({ chat_link: link });
  };

  editChatInfo = async (chatId: number, extra: EditChatExtra) => {
    return this.raw.chats.edit({ chat_id: chatId, ...extra });
  };

  sendMessageToChat = async (
    chatId: number,
    text: string,
    extra?: SendMessageExtra,
  ) => {
    const { message } = await this.raw.messages.send({
      chat_id: chatId,
      text,
      ...extra,
    });
    return message;
  };

  sendMessageToUser = async (
    userId: number,
    text: string,
    extra?: SendMessageExtra,
  ) => {
    const { message } = await this.raw.messages.send({
      user_id: userId,
      text,
      ...extra,
    });
    return message;
  };

  getMessages = async (chatId: number, { message_ids, ...extra }: GetMessagesExtra = {}) => {
    return this.raw.messages.get({
      chat_id: chatId,
      message_ids: message_ids?.join(','),
      ...extra,
    });
  };

  getMessage = async (id: string) => {
    return this.raw.messages.getById({ message_id: id });
  };

  editMessage = async (
    messageId: string,
    extra?: EditMessageExtra,
  ) => {
    return this.raw.messages.edit({
      message_id: messageId,
      ...extra,
    });
  };

  deleteMessage = async (
    messageId: string,
    extra?: DeleteMessageExtra,
  ) => {
    return this.raw.messages.delete({ message_id: messageId, ...extra });
  };

  answerOnCallback = async (
    callbackId: string,
    extra?: AnswerOnCallbackExtra,
  ) => {
    return this.raw.messages.answerOnCallback({ callback_id: callbackId, ...extra });
  };

  getChatMembership = (chatId: number) => {
    return this.raw.chats.getChatMembership({ chat_id: chatId });
  };

  getChatAdmins = (chatId: number) => {
    return this.raw.chats.getChatAdmins({ chat_id: chatId });
  };

  addChatMembers = (chatId: number, userIds: number[]) => {
    return this.raw.chats.addChatMembers({
      chat_id: chatId,
      user_ids: userIds,
    });
  };

  getChatMembers = (chatId: number, { user_ids, ...extra }: GetChatMembersExtra = {}) => {
    return this.raw.chats.getChatMembers({
      chat_id: chatId,
      user_ids: user_ids?.join(','),
      ...extra,
    });
  };

  removeChatMember = (chatId: number, userId: number) => {
    return this.raw.chats.removeChatMember({
      chat_id: chatId,
      user_id: userId,
    });
  };

  getUpdates = async (
    types: MaybeArray<UpdateType> = [],
    extra: Omit<FlattenReq<GetUpdatesDTO>, 'types'> = {},
  ) => {
    return this.raw.subscriptions.getUpdates({
      types: Array.isArray(types) ? types.join(',') : types,
      ...extra,
    });
  };

  getPinnedMessage = async (chatId: number) => {
    return this.raw.chats.getPinnedMessage({ chat_id: chatId });
  };

  pinMessage = async (chatId: number, messageId: string, extra?: PinMessageExtra) => {
    return this.raw.chats.pinMessage({
      chat_id: chatId,
      message_id: messageId,
      ...extra,
    });
  };

  unpinMessage = async (chatId: number) => {
    return this.raw.chats.unpinMessage({ chat_id: chatId });
  };

  sendAction = async (chatId: number, action: SenderAction) => {
    return this.raw.chats.sendAction({
      chat_id: chatId,
      action,
    });
  };

  leaveChat = async (chatId: number) => {
    return this.raw.chats.leaveChat({ chat_id: chatId });
  };

  uploadImage = async (options: UploadImageOptions) => {
    const data = await this.upload.image(options);
    return new ImageAttachment(data);
  };

  uploadVideo = async (options: UploadVideoOptions) => {
    const data = await this.upload.video(options);
    return new VideoAttachment({ token: data.token });
  };

  uploadAudio = async (options: UploadAudioOptions) => {
    const data = await this.upload.audio(options);
    return new AudioAttachment({ token: data.token });
  };

  uploadFile = async (options: UploadFileOptions) => {
    const data = await this.upload.file(options);
    return new FileAttachment({ token: data.token });
  };
}
