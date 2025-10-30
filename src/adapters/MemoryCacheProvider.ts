import {CacheKey, CacheProvider, Pipeline, SerializationOptions, TTL} from "./base";

interface CacheEntry {
    value: string;
    expiresAt?: number;
}

class MemoryPipeline<T> implements Pipeline<T> {
    private operations: (() => Promise<any>)[] = [];
    private cache: Map<string, CacheEntry>;
    private provider: MemoryCacheProvider<T>;

    constructor(cache: Map<string, CacheEntry>, provider: MemoryCacheProvider<T>) {
        this.cache = cache;
        this.provider = provider;
    }

    get(key: CacheKey): Pipeline<T> {
        this.operations.push(async () => {
            const entry = this.cache.get(key);
            if (!entry || (entry.expiresAt && entry.expiresAt < Date.now())) {
                return null;
            }
            return this.provider.deserialize(entry.value);
        });
        return this;
    }

    set(key: CacheKey, data: T, ttl?: number): Pipeline<T> {
        this.operations.push(async () => {
            const serializedValue = this.provider.serialize(data);
            const entry: CacheEntry = {
                value: serializedValue,
                expiresAt: ttl ? Date.now() + ttl * 1000 : undefined
            };
            this.cache.set(key, entry);
            return "OK";
        });
        return this;
    }

    del(key: CacheKey): Pipeline<T> {
        this.operations.push(async () => {
            return this.cache.delete(key) ? 1 : 0;
        });
        return this;
    }

    expire(key: CacheKey, new_ttl_from_now: number): Pipeline<T> {
        this.operations.push(async () => {
            const entry = this.cache.get(key);
            if (!entry) return 0;
            entry.expiresAt = Date.now() + new_ttl_from_now * 1000;
            return 1;
        });
        return this;
    }

    async exec(): Promise<any[]> {
        const results = await Promise.all(this.operations.map(op => op()));
        this.operations = [];
        return results;
    }
}

export class MemoryCacheProvider<T> implements CacheProvider<T> {
    readonly storesAsObj: boolean = false;
    private readonly cache: Map<string, CacheEntry>;
    private readonly _serializationOptions: SerializationOptions;

    get serializationOptions(): SerializationOptions {
        return this._serializationOptions;
    }

    constructor(serializationOptions: SerializationOptions = {}) {
        this.cache = new Map();
        this._serializationOptions = serializationOptions;
    }

    name(): string {
        return "memory";
    }

    async get(key: CacheKey): Promise<T | null> {
        const entry = this.cache.get(key);
        if (!entry || this.isExpired(entry)) {
            if (entry) this.cache.delete(key);
            return null;
        }
        return this.deserialize(entry.value);
    }

    async mget(...keys: CacheKey[]): Promise<(T | null)[]> {
        return Promise.all(keys.map(key => this.get(key)));
    }

    async mset(...keyValues: [CacheKey, T][]): Promise<"OK" | null> {
        for (const [key, value] of keyValues) {
            await this.set(key, value);
        }
        return "OK";
    }

    async set(key: CacheKey, data: T, ttl?: TTL): Promise<"OK" | null> {
        const serializedValue = this.serialize(data);
        const entry: CacheEntry = {
            value: serializedValue,
            expiresAt: ttl ? Date.now() + ttl * 1000 : undefined
        };
        this.cache.set(key, entry);
        return "OK";
    }

    async del(...keys: CacheKey[]): Promise<number> {
        let count = 0;
        for (const key of keys) {
            if (this.cache.delete(key)) {
                count++;
            }
        }
        return count;
    }

    async expire(key: CacheKey, new_ttl_from_now: TTL): Promise<0 | 1> {
        const entry = this.cache.get(key);
        if (!entry) return 0;
        entry.expiresAt = Date.now() + new_ttl_from_now * 1000;
        return 1;
    }

    pipeline(): Pipeline<T> {
        return new MemoryPipeline<T>(this.cache, this);
    }

    async flushdb(): Promise<number> {
        const count = this.cache.size;
        this.cache.clear();
        return count;
    }

    private isExpired(entry: CacheEntry): boolean {
        return entry.expiresAt !== undefined && entry.expiresAt < Date.now();
    }

    serialize(data: T): string {
        const serializer = this._serializationOptions.serializer;
        return serializer ? serializer('', data) : JSON.stringify(data);
    }

    deserialize(value: string): T {
        const deserializer = this._serializationOptions.deserializer;
        return deserializer ? deserializer('', JSON.parse(value)) : JSON.parse(value);
    }
}
