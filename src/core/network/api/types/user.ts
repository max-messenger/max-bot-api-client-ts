export type User = {
  user_id: number;
  /** @deprecated Используйте поля first_name и last_name вместо этого. */
  name: string;
  first_name: string;
  last_name?: string;
  username: string | null;
  is_bot: boolean;
  last_activity_time: number;
};

export type UserWithPhoto = User & {
  description?: string | null;
  avatar_url?: string;
  full_avatar_url?: string;
};

export const enum UserLocale {

}
