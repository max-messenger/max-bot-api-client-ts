import {
  Button,
  CallbackButton, ChatButton,
  LinkButton,
  RequestContactButton,
  RequestGeoLocationButton,
} from '../network/api';

type MakeExtra<
    T extends Button,
    O extends keyof Omit<T, 'text' | 'type'> | '' = '',
> = Omit<T, 'text' | 'type' | O>;

export const callback = (
  text: string,
  payload: string,
  extra?: MakeExtra<CallbackButton, 'payload'>,
): CallbackButton => {
  return {
    type: 'callback', text, payload, ...extra,
  };
};

export const link = (text: string, url: string): LinkButton => {
  return {
    type: 'link', text, url,
  };
};

export const requestContact = (text: string): RequestContactButton => {
  return {
    type: 'request_contact', text,
  };
};

export const requestGeoLocation = (
  text: string,
  extra?: MakeExtra<RequestGeoLocationButton>,
): RequestGeoLocationButton => {
  return {
    type: 'request_geo_location', text, ...extra,
  };
};

export const chat = (
  text: string,
  chatTitle: string,
  extra?: MakeExtra<ChatButton, 'chat_title'>,
): ChatButton => {
  return {
    type: 'chat', text, chat_title: chatTitle, ...extra,
  };
};
