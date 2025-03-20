type MakeMarkup<Type extends string, Data extends object> = {
  type: Type;
  from: number;
  length: number;
} & {
  [key in keyof Data]: Data[key];
};

export type UserMentionMarkup = MakeMarkup<'user_mention', {
  user_link?: string | null;
  user_id?: number | null;
}>;

// TODO: Типизация для MarkupElement
export type MarkupElement =
  | UserMentionMarkup;
