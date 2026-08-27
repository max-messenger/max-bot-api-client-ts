type MakeMarkup<Type extends string, Data extends object> = {
  type: Type;
  from: number;
  length: number;
} & {
  [key in keyof Data]: Data[key];
};

export type MarkupType  =
  | 'strong'
  | 'emphasized'
  | 'monospaced'
  | 'link'
  | 'strikethrough'
  | 'underline'
  | 'heading'
  | 'highlighted'
  | 'quote';

type BaseMarkup = MakeMarkup<MarkupType, {}>

export type UserMentionMarkup = MakeMarkup<'user_mention', {
  user_link?: string | null;
  user_id?: number | null;
}>;

export type MarkupElement = BaseMarkup | UserMentionMarkup
