
interface CacheProviderCore {
    get(key: string): Promise<any | null>;

    mget(...key: string[]): Promise<(any | null)[]>

    set(key: string, data: any, ttl?: number): Promise<"OK" | null>;

    del(...key: string[]): Promise<number>;

    expire(key: string, new_ttl_from_now: number): Promise<0 | 1>;
}

export interface CacheProvider extends CacheProviderCore {
    name(): string;

    pipeline(): Pipeline;
}

export interface Pipeline {
    get(key: string): Pipeline;

    set(key: string, data: string, ttl?: number): Pipeline;

    del(key: string): Pipeline;

    expire(key: string, new_ttl_from_now: number): Pipeline;

    exec(): Promise<any[]>;
}

