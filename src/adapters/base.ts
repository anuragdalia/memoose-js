export type CacheKey = string
export type TTL = number

interface CacheProviderCore<T> {
  get(key: CacheKey): Promise<T | null>;

  mget(...key: CacheKey[]): Promise<(T | null)[]>

  mset(...key: [CacheKey, T][]): Promise<"OK" | null>

  set(key: CacheKey, data: T, ttl?: TTL): Promise<"OK" | null>;

  del(...key: CacheKey[]): Promise<number>;

  expire(key: CacheKey, new_ttl_from_now: TTL): Promise<0 | 1>;
}

export type TReplacerFunction = (key: string, value: any) => string;
export type TReviverFunction = (key: string, value: any) => any;

export interface CacheProvider<T> extends CacheProviderCore<T> {
  name(): string;

  pipeline(): Pipeline<T>;

  get storesAsObj(): boolean

  get jsonStringifyReplacer(): TReplacerFunction | undefined;
  get jsonParseReviver(): TReviverFunction | undefined;
}

export interface Pipeline<T> {
  get(key: CacheKey): Pipeline<T>;

  set(key: CacheKey, data: T, ttl?: number): Pipeline<T>;

  del(key: CacheKey): Pipeline<T>;

  expire(key: CacheKey, new_ttl_from_now: number): Pipeline<T>;

  exec(): Promise<any[]>;
}

