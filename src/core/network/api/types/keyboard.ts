export type CallbackButton = {
  type: 'callback';
  text: string;
  payload: string;
};

export type LinkButton = {
  type: 'link';
  text: string;
  url: string;
};

export type ClipboardButton = {
  type: 'clipboard',
  text: string
  payload: string
}

export type RequestContactButton = {
  type: 'request_contact';
  text: string;
};

export type RequestGeoLocationButton = {
  type: 'request_geo_location';
  text: string;
  quick?: boolean;
};

export type MessageButton = {
  type: 'message';
  text: string;
}

export type OpenAppButton = {
  type: 'open_app';
  text: string;
  web_app?: string | null;
  contact_id?: number | null;
  payload?: string | null;
};

export type Button =
  | CallbackButton
  | LinkButton
  | RequestContactButton
  | RequestGeoLocationButton
  | OpenAppButton
  | ClipboardButton
  | MessageButton
