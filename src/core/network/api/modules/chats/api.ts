import { BaseApi } from '../../base-api';
import type { FlattenReq } from '../types';
import type {
  AddChatMembersDTO, AddChatMembersResponse,
  EditChatInfoDTO,
  EditChatInfoResponse,
  GetAllChatsDTO,
  GetAllChatsResponse,
  GetChatAdminsDTO,
  GetChatAdminsResponse,
  GetChatByIdDTO,
  GetChatByIdResponse,
  GetChatByLinkDTO,
  GetChatByLinkResponse,
  GetChatMembersDTO,
  GetChatMembershipDTO,
  GetChatMembershipResponse,
  GetChatMembersResponse,
  GetPinnedMessageDTO,
  GetPinnedMessageResponse,
  LeaveChatDTO,
  LeaveChatResponse,
  PinMessageDTO,
  PinMessageResponse, RemoveChatMemberDTO, RemoveChatMemberResponse,
  SendActionDTO,
  SendActionResponse,
  UnpinMessageDTO,
  UnpinMessageResponse,
} from './types';

export class ChatsApi extends BaseApi {
  async getAll({ ...query }: FlattenReq<GetAllChatsDTO>): Promise<GetAllChatsResponse> {
    return this._get('chats', {
      query,
    });
  }

  async getById({ chat_id }: FlattenReq<GetChatByIdDTO>): Promise<GetChatByIdResponse> {
    return this._get('chats/{chat_id}', {
      path: { chat_id },
    });
  }

  async getByLink({ chat_link }: FlattenReq<GetChatByLinkDTO>): Promise<GetChatByLinkResponse> {
    return this._get('chats/{chat_link}', {
      path: { chat_link },
    });
  }

  async edit({ chat_id, ...body }: FlattenReq<EditChatInfoDTO>): Promise<EditChatInfoResponse> {
    return this._patch('chats/{chat_id}', {
      path: { chat_id },
      body,
    });
  }

  async getChatMembership(
    { chat_id }: FlattenReq<GetChatMembershipDTO>,
  ): Promise<GetChatMembershipResponse> {
    return this._get('chats/{chat_id}/members/me', {
      path: { chat_id },
    });
  }

  async getChatAdmins({ chat_id }: FlattenReq<GetChatAdminsDTO>): Promise<GetChatAdminsResponse> {
    return this._get('chats/{chat_id}/members/admins', {
      path: { chat_id },
    });
  }

  async addChatMembers(
    { chat_id, ...body }: FlattenReq<AddChatMembersDTO>,
  ): Promise<AddChatMembersResponse> {
    return this._post('chats/{chat_id}/members', {
      path: { chat_id },
      body,
    });
  }

  async getChatMembers(
    { chat_id, ...query }: FlattenReq<GetChatMembersDTO>,
  ): Promise<GetChatMembersResponse> {
    return this._get('chats/{chat_id}/members', {
      path: { chat_id },
      query,
    });
  }

  async removeChatMember(
    { chat_id, ...body }: FlattenReq<RemoveChatMemberDTO>,
  ): Promise<RemoveChatMemberResponse> {
    return this._delete('chats/{chat_id}/members', {
      path: { chat_id },
      body,
    });
  }

  async getPinnedMessage(
    { chat_id }: FlattenReq<GetPinnedMessageDTO>,
  ): Promise<GetPinnedMessageResponse> {
    return this._get('chats/{chat_id}/pin', {
      path: { chat_id },
    });
  }

  async pinMessage({ chat_id, ...body }: FlattenReq<PinMessageDTO>): Promise<PinMessageResponse> {
    return this._put('chats/{chat_id}/pin', {
      path: { chat_id },
      body,
    });
  }

  async unpinMessage({ chat_id }: FlattenReq<UnpinMessageDTO>): Promise<UnpinMessageResponse> {
    return this._delete('chats/{chat_id}/pin', {
      path: { chat_id },
    });
  }

  async sendAction({ chat_id, ...body }: FlattenReq<SendActionDTO>): Promise<SendActionResponse> {
    return this._post('chats/{chat_id}/actions', {
      path: { chat_id },
      body,
    });
  }

  async leaveChat({ chat_id }: FlattenReq<LeaveChatDTO>): Promise<LeaveChatResponse> {
    return this._delete('chats/{chat_id}/members/me', {
      path: { chat_id },
    });
  }
}
