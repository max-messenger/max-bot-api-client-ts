import type { InlineKeyboardAttachmentRequest } from '../core/network/api';

export const inlineKeyboard = (
  buttons: InlineKeyboardAttachmentRequest['payload']['buttons'],
): InlineKeyboardAttachmentRequest => {
  return {
    type: 'inline_keyboard',
    payload: { buttons },
  };
};

export * as button from './buttons';
