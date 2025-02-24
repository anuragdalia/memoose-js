import {CacheKey, CacheProvider, Pipeline} from "./base";
import {setInterval} from "timers";


type CacheInternalObj = { data: any, reject: boolean }

class CacheObject {
    key: string;
    data: { data: any, reject: boolean };
    ttl: number;

    constructor(key: string, data: CacheInternalObj, ttl: number) {
        this.key = key;
        this.data = data;
        this.ttl = ttl;
    }
}

export class MemoryCacheProvider implements CacheProvider<CacheInternalObj> {
    private readonly store: Record<string, CacheObject>;
    readonly storesAsObj: boolean = true
    // Note: science this is a memory cache stores directly Objects, we don't need to worry about serialization/de-serialization
    readonly jsonParseReviver = undefined
    readonly jsonStringifyReplacer = undefined 

    constructor() {
        this.store = {};
        setInterval(() => {
            for (const key in this.store) {
                if (this.store[key].ttl < Date.now()) {
                    delete this.store[key];
                }
            }
        }, 1000);
    }

    pipeline(): Pipeline<CacheInternalObj> {
        throw new Error("Method not implemented.");
    }

    name(): string {
        return "memory";
    }

    expire(key: string, new_ttl_from_now: number): Promise<0 | 1> {
        const now = Date.now()
        const object: CacheObject = this.store[key];
        if (!!object && object.ttl > now) {
            object.ttl = now + (new_ttl_from_now * 1000);
            return Promise.resolve(1);
        }
        return Promise.resolve(0);
    }

    del(...keys: string[]): Promise<number> {
        keys.forEach(key => delete this.store[key]);
        return Promise.resolve(keys.length);
    }

    set(key: string, data: CacheInternalObj, ttl: number): Promise<any> {
        this.store[key] = new CacheObject(key, data, Date.now() + (ttl * 1000));
        return Promise.resolve(data);
    }

    get(key: string): Promise<any | null> {
        const object: CacheObject = this.store[key];
        if (!!object) {
            if (object.ttl < Date.now()) {
                return this.del(key).then(_ => null);
            }
            return Promise.resolve(object.data);
        } else {
            return Promise.resolve(null);
        }
    }

    dump() {
        return Promise.resolve(this.store);
    }

    flushdb() {
        return this.del(...Object.keys(this.store))
    }

    async mget(...keys: CacheKey[]): Promise<(any | null)[]> {
        const now = Date.now()
        return Promise.all(keys.map(async (obj, index) => {
            const object: CacheObject = this.store[keys[index]];
            if (!!object) {
                if (object.ttl < now) {
                    await this.del(keys[index])
                    return null;
                }
                return object.data;
            } else {
                return null;
            }
        }))
    }

    async mset(...kvPairs: [CacheKey, CacheInternalObj][]): Promise<"OK" | null> {
        //hardcoded to 5mins ttl
        kvPairs.forEach(([cachekey, obj]) => this.set(cachekey, obj, 300))
        return "OK"
    }
}

