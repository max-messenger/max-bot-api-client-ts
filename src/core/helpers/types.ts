export type NullableObject<T> = {
  [K in keyof T]: T[K] | null
};

export type MaybeArray<T> = T | T[];

export type MaybePromise<T> = T | Promise<T>;

export type Guard<X = unknown, Y extends X = X> = (x: X) => x is Y;

export type Guarded<F> = F extends (x: any) => x is infer T ? T : never;
