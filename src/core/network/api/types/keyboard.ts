export type ButtonIntent = 'default' | 'positive' | 'negative';

export type CallbackButton = {
  type: 'callback';
  text: string;
  payload: string;
  intent?: ButtonIntent;
};

export type LinkButton = {
  type: 'link';
  text: string;
  url: string;
};

export type RequestContactButton = {
  type: 'request_contact';
  text: string;
};

export type RequestGeoLocationButton = {
  type: 'request_geo_location';
  text: string;
  quick?: boolean;
};

export type ChatButton = {
  type: 'chat',
  text: string;
  chat_title: string;
  chat_description?: string | null;
  start_payload?: string | null;
  uuid?: string | null;
};

export type Button =
  | CallbackButton
  | LinkButton
  | RequestContactButton
  | RequestGeoLocationButton
  | ChatButton;
