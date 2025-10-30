import IORedis, {Redis, RedisOptions} from "ioredis";
import {CacheKey, CacheProvider, Pipeline, SerializationOptions, TTL} from "./base";

export class RedisCacheProvider implements CacheProvider<string> {

    name(): string {
        return "redis";
    }

    readonly storesAsObj: boolean = false
    private readonly _serializationOptions: SerializationOptions

    get serializationOptions(): SerializationOptions {
        return this._serializationOptions;
    }

    private readonly client_client: Redis;
    private readonly connected_promise: any;
    private readonly connect: boolean;

    constructor(
        name: string,
        options: RedisOptions,
        connect: boolean = true,
        serializationOptions: SerializationOptions = {}
    ) {
        this.client_client = new IORedis(options);
        this.connect = connect;
        if (connect)
            this.connected_promise = this.client_client.connect();
        else
            this.connected_promise = Promise.resolve("told not to connect");
        this._serializationOptions = serializationOptions;

        const errorOrCloseCB = (...args: any[]) => {
            console.log(`Error in RedisClient: ${name}.`, "\r\n", ...args);
            process.exit(55666);
        }
        this.client_client.on("end", errorOrCloseCB.bind(null, "end"))
        this.client_client.on("error", errorOrCloseCB.bind(null, "error"));
        this.client_client.on("close", errorOrCloseCB.bind(null, "close"));
        this.client_client.on("finish", errorOrCloseCB.bind(null, "finish"));
    }

    getClientConnectionPromise() {
        if (this.connect)
            return this.connected_promise;
        else
            throw new Error("shouldnt call as client initialised with connect=false");
    }

    async get(key: string): Promise<string | null> {
        return this.client_client.get(key);
    }

    async set(key: string, value: string, ttl?: TTL): Promise<"OK" | null> {
        if (ttl && ttl > 0)
            return this.client_client.set(key, value, "EX", ttl);
        else
            return this.client_client.set(key, value);
    }

    async del(...keys: string[]): Promise<number> {
        return this.client_client.del(...keys);
    }

    awaitTillReady() {
        return new Promise((resolve, reject) => {
            this.client_client.once("ready", resolve);
            this.client_client.once("error", reject);
        })
    }

    get client(): Redis {
        return this.client_client;
    }

    pipeline(): Pipeline<string> {
        return this.client_client.pipeline() as any;
    }

    async expire(key: string, ttl: number): Promise<0 | 1> {
        return this.client_client.expire(key, ttl) as Promise<0 | 1>;
    }

    async mget(...keys: string[]): Promise<(string | null)[]> {
        return this.client_client.mget(...keys);
    }

    async mset(...keyValues: [CacheKey, string][]): Promise<"OK" | null> {
        return this.client_client.mset(...keyValues as any);
    }

    exists(...keys: string[]) {
        return this.client_client.exists(...keys);
    }

    lpush(key: string, ...values: string[]) {
        return this.client_client.lpush(key, ...values);
    }

    llen(key: string) {
        return this.client_client.llen(key);
    }

    scard(key: string) {
        return this.client_client.scard(key);
    }

    sismember(key: string, member: string) {
        return this.client_client.sismember(key, member);
    }

    sadd(key: string, member: any) {
        return this.client_client.sadd(key, member);
    }

    srem(key: string, member: any) {
        return this.client_client.srem(key, member);
    }

    smembers(key: string) {
        return this.client_client.smembers(key);
    }

    rpush(key: string, ...values: any[]) {
        return this.client_client.rpush(key, ...values);
    }

    lrange(key: string, start: number, stop: number) {
        return this.client_client.lrange(key, start, stop);
    }

    ping() {
        return this.client_client.ping();
    }

    subscribe(...channels: any[]) {
        return this.client_client.subscribe(...channels);
    }

    on(event: string, listener: (...args: any[]) => void) {
        return this.client_client.on(event, listener);
    }

    publish(channel: string, message: string) {
        return this.client_client.publish(channel, message);
    }

    flushdb() {
        return this.client_client.flushdb();
    }

    lpop(key: string) {
        return this.client_client.lpop(key)
    }

    decrby(key: string, count: number) {
        return this.client_client.decrby(key, count);
    }
}
