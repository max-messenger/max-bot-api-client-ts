export type MarkupType  =
  | 'strong'
  | 'emphasized'
  | 'monospaced'
  | 'link'
  | 'strikethrough'
  | 'underline'
  | 'user_mention'
  | 'heading'
  | 'highlighted'
  | 'quote';

export type MarkupElement = {
  type: MarkupType;
  from: number;
  length: number;
}
