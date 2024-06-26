import {CacheProvider, Pipeline} from "./base";
import {setInterval} from "timers";

class CacheObject {
    key: string;
    data: { data: any, reject: boolean };
    ttl: number;

    constructor(key: string, data: { data: any, reject: boolean }, ttl: number) {
        this.key = key;
        this.data = data;
        this.ttl = ttl;
    }
}

export class MemoryCacheProvider implements CacheProvider {
    private readonly store: Record<string, CacheObject>;

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

    pipeline(): Pipeline {
        throw new Error("Method not implemented.");
    }

    name(): string {
        return "memory";
    }

    expire(key: string, new_ttl_from_now: number): Promise<0 | 1> {
        const object: CacheObject = this.store[key];
        if (!!object && object.ttl < Date.now()) {
            object.ttl = Date.now() + (new_ttl_from_now * 1000);
            return Promise.resolve(1);
        }
        return Promise.resolve(0);
    }

    del(...keys: string[]): Promise<number> {
        keys.forEach(key => delete this.store[key]);
        return Promise.resolve(keys.length);
    }

    set(key: string, data: { data: any, reject: boolean }, ttl: number): Promise<any> {
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

    mget(...keys: string[]): Promise<(any | null)[]> {
        return Promise.all(keys.map((obj, index) => {
            const object: CacheObject = this.store[keys[index]];
            if (!!object) {
                if (object.ttl < Date.now()) {
                    return this.del(keys[index]).then(_ => null);
                }
                return Promise.resolve(object.data);
            } else {
                return Promise.resolve(null);
            }
        }))
    }
}

