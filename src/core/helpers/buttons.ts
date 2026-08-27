import {
  Button,
  CallbackButton,
  ClipboardButton,
  LinkButton, MessageButton,
  OpenAppButton,
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
): CallbackButton => {
  return {
    type: 'callback', text, payload,
  };
};

export const clipboard = (
  text: string,
  payload: string,
): ClipboardButton => {
  return {
    type: 'clipboard', text, payload,
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

export const message = (
  text: string,
): MessageButton => {
  return {
    type: 'message', text,
  };
};


export const openApp = (
  text: string,
  webApp: string,
  contactId?: number,
  payload?: string,
): OpenAppButton => {
  return {
    type: 'open_app', text, web_app: webApp, contact_id: contactId, payload,
  };
};
