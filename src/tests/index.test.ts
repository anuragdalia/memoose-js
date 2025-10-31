import {beforeEach, describe, expect, test} from "bun:test";
import {
    CachedItem,
    Memoize,
    MemoizeConfig,
    MemoryCacheProvider,
    RedisCacheProvider,
    SerializationOptions
} from "../index";

// Create Redis cache provider with custom serialization options for handling BigInt
const bigIntSerializationOptions: SerializationOptions = {
    serializer: (key: string, value: any): any => {
        // Handle BigInt values which aren't serializable in standard JSON
        if (typeof value === 'bigint') {
            return `__BIGINT__${value.toString()}`;
        }
        return value;
    },
    deserializer: (key: string, value: any): any => {
        // Convert serialized BigInt strings back to BigInt objects
        if (typeof value === 'string' && value.startsWith('__BIGINT__')) {
            return BigInt(value.substring(10));
        }
        return value;
    }
};

// Redis provider with BigInt serialization support
const redisCP = new RedisCacheProvider(
    "redis",
    {lazyConnect: true},
    true,
    bigIntSerializationOptions
);

const memoryCP = new MemoryCacheProvider<CachedItem>(bigIntSerializationOptions);

function generateTester<R extends Array<any> = any[], T = any>(memoizeConfig: MemoizeConfig<R, T>) {
    let lastCallWasHit = true
    let simulateRejection = false

    async function computeSum(...args: any[]) {
        lastCallWasHit = false
        if (simulateRejection) {
            return Promise.reject("RejectionSimulation triggered")
        }
        return args.reduce((acc, curr) => acc + curr, 0);
    }

    return {
        get wasLastCallAHit() {
            return lastCallWasHit
        },
        reset() {
            lastCallWasHit = true;
            simulateRejection = false;
        },
        simulateRejection: (bool: boolean) => simulateRejection = bool,
        testObj: new Memoize<R, T>(computeSum, 10, memoizeConfig)
    }
}


async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

describe("Memoize Tests", () => {
    beforeEach(async () => {
        await redisCP.flushdb();
        await memoryCP.flushdb();
    });

    describe("Redis Cache Provider", () => {
        test("should handle basic memoization functions", async () => {
            const tester = generateTester({cacheProvider: redisCP});
            const expectedResult = 6;  // 1 + 2 + 3
            const updatedValue = 999;

            // Test cache miss
            const r1 = await tester.testObj.call(1, 2, 3);
            expect(r1).toBe(expectedResult);
            tester.reset();

            // Test cache hit
            const r2 = await tester.testObj.call(1, 2, 3);
            expect(r2).toBe(expectedResult);
            expect(tester.wasLastCallAHit).toBe(true);
            tester.reset();

            // Test exec (bypassing cache)
            const r3 = await tester.testObj.exec(1, 2, 3);
            expect(r3).toBe(expectedResult);
            tester.reset();

            // Test update
            await tester.testObj.update(1, 2, 3, updatedValue);
            const r4 = await tester.testObj.call(1, 2, 3);
            expect(r4).toBe(updatedValue);
            tester.reset();

            // Test demoize
            await tester.testObj.demoize(1, 2, 3);
            await sleep(500);
            const r5 = await tester.testObj.call(1, 2, 3);
            expect(r5).toBe(expectedResult);
            expect(tester.wasLastCallAHit).toBe(false);
            tester.reset();

            // Test refresh
            await tester.testObj.refresh(1, 2, 3);
            const r6 = await tester.testObj.call(1, 2, 3);
            expect(r6).toBe(expectedResult);
            tester.reset();

            // Test setExp (TTL)
            await tester.testObj.setExp(1, 2, 3, 1);  // Setting TTL to 1 second
            await sleep(4000);  // Wait for cache to expire
            const r7 = await tester.testObj.call(1, 2, 3);
            expect(r7).toBe(expectedResult);
            expect(tester.wasLastCallAHit).toBe(false);
        });

        test("should handle multi operations", async () => {
            const tester = generateTester({cacheProvider: redisCP});
            const expectedResultMultiExec = [6, 15];  // [1+2+3, 4+5+6]

            // Test multiExec
            const r1 = await tester.testObj.multiExec([1, 2, 3], [4, 5, 6]);
            expect(r1).toEqual(expectedResultMultiExec);
            tester.reset();

            // Test multiCall cache miss
            const r2 = await tester.testObj.multiCall([1, 2, 3], [4, 5, 6]);
            expect(r2).toEqual(expectedResultMultiExec);
            tester.reset();

            // Test multiCall cache hit
            const r3 = await tester.testObj.multiCall([1, 2, 3], [4, 5, 6]);
            expect(r3).toEqual(expectedResultMultiExec);
            expect(tester.wasLastCallAHit).toBe(true);
            tester.reset();

            // Test rejection scenario
            await tester.testObj.demoize(1, 2, 3);
            tester.simulateRejection(true);
            await expect(tester.testObj.multiCall([1, 2, 3], [4, 5, 6])).rejects.toBe("RejectionSimulation triggered");
        });

        test("should NOT cache rejections in multiCall (retry-friendly)", async () => {
            const tester = generateTester({cacheProvider: redisCP});

            // Clear any cached values
            await tester.testObj.demoize(1, 2, 3);
            await tester.testObj.demoize(4, 5, 6);

            // Enable rejection simulation
            tester.simulateRejection(true);

            // Test that multiCall rejects when function fails
            await expect(tester.testObj.multiCall([1, 2, 3], [4, 5, 6])).rejects.toBe("RejectionSimulation triggered");

            // Disable rejection - second call should succeed immediately
            // This is the desired behavior: rejections are NOT cached in multiCall
            tester.simulateRejection(false);
            tester.reset();

            // This call should succeed because rejections were NOT cached
            const result = await tester.testObj.multiCall([1, 2, 3], [4, 5, 6]);
            expect(result).toEqual([6, 15]);
            expect(tester.wasLastCallAHit).toBe(false); // Function executed (not from cache)

            // Verify that single call DOES cache rejections (for comparison)
            tester.simulateRejection(true);
            await expect(tester.testObj.call(7, 8, 9)).rejects.toBe("RejectionSimulation triggered");

            tester.simulateRejection(false);
            tester.reset();

            // Single call returns cached rejection
            await expect(tester.testObj.call(7, 8, 9)).rejects.toBe("RejectionSimulation triggered");
            expect(tester.wasLastCallAHit).toBe(true); // Rejection was cached
        });

        test("should handle cache key generation with order variation", async () => {
            const tester = generateTester({cacheProvider: redisCP, argsOrderVain: true});
            await tester.testObj.call(3, 2, 1);
            tester.reset();
            await tester.testObj.call(1, 2, 3);
            expect(tester.wasLastCallAHit).toBe(true);
        });

        test("should handle serialization", async () => {
            const tester = generateTester({cacheProvider: redisCP});
            const complexObject = {a: [1, 2, 3], b: {c: "test"}};
            await tester.testObj.update(1, complexObject);
            const result = await tester.testObj.call(1);
            expect(result).toEqual(complexObject);
        });

        test("should handle BigInt serialization", async () => {
            const tester = generateTester({cacheProvider: redisCP});
            const dbRecord = {
                id: BigInt(9007199254740991),
                name: "Test Record",
                timestamp: BigInt(1682536789123)
            };

            await tester.testObj.update(2, dbRecord);
            const result = await tester.testObj.call(2);

            expect(typeof result.id).toBe('bigint');
            expect(result.id).toBe(dbRecord.id);
            expect(typeof result.timestamp).toBe('bigint');
            expect(result.timestamp).toBe(dbRecord.timestamp);
        });

        test("should handle multi operations with override", async () => {
            const tester = generateTester({
                cacheProvider: redisCP,
                multiExecOverride: async function (...argss: number[][]) {
                    return argss.map(args => args.reduce((acc, curr) => acc + curr, 0))
                }
            });
            const expectedResult = [6, 15];  // [1+2+3, 4+5+6]
            const result = await tester.testObj.multiExec([1, 2, 3], [4, 5, 6]);
            expect(result).toEqual(expectedResult);
        });
    });

    describe("Memory Cache Provider", () => {
        test("should handle basic memoization functions", async () => {
            const tester = generateTester({cacheProvider: memoryCP});
            const expectedResult = 6;  // 1 + 2 + 3
            const updatedValue = 999;

            // Test cache miss
            const r1 = await tester.testObj.call(1, 2, 3);
            expect(r1).toBe(expectedResult);
            tester.reset();

            // Test cache hit
            const r2 = await tester.testObj.call(1, 2, 3);
            expect(r2).toBe(expectedResult);
            expect(tester.wasLastCallAHit).toBe(true);
            tester.reset();

            // Test exec (bypassing cache)
            const r3 = await tester.testObj.exec(1, 2, 3);
            expect(r3).toBe(expectedResult);
            tester.reset();

            // Test update
            await tester.testObj.update(1, 2, 3, updatedValue);
            const r4 = await tester.testObj.call(1, 2, 3);
            expect(r4).toBe(updatedValue);
            tester.reset();

            // Test demoize
            await tester.testObj.demoize(1, 2, 3);
            await sleep(500);
            const r5 = await tester.testObj.call(1, 2, 3);
            expect(r5).toBe(expectedResult);
            expect(tester.wasLastCallAHit).toBe(false);
            tester.reset();

            // Test refresh
            await tester.testObj.refresh(1, 2, 3);
            const r6 = await tester.testObj.call(1, 2, 3);
            expect(r6).toBe(expectedResult);
            tester.reset();

            // Test setExp (TTL)
            await tester.testObj.setExp(1, 2, 3, 1);  // Setting TTL to 1 second
            await sleep(4000);  // Wait for cache to expire
            const r7 = await tester.testObj.call(1, 2, 3);
            expect(r7).toBe(expectedResult);
            expect(tester.wasLastCallAHit).toBe(false);
        });

        test("should handle multi operations", async () => {
            const tester = generateTester({cacheProvider: memoryCP});
            const expectedResultMultiExec = [6, 15];  // [1+2+3, 4+5+6]

            // Test multiExec
            const r1 = await tester.testObj.multiExec([1, 2, 3], [4, 5, 6]);
            expect(r1).toEqual(expectedResultMultiExec);
            tester.reset();

            // Test multiCall cache miss
            const r2 = await tester.testObj.multiCall([1, 2, 3], [4, 5, 6]);
            expect(r2).toEqual(expectedResultMultiExec);
            tester.reset();

            // Test multiCall cache hit
            const r3 = await tester.testObj.multiCall([1, 2, 3], [4, 5, 6]);
            expect(r3).toEqual(expectedResultMultiExec);
            expect(tester.wasLastCallAHit).toBe(true);
            tester.reset();

            // Test rejection scenario
            await tester.testObj.demoize(1, 2, 3);
            tester.simulateRejection(true);
            await expect(tester.testObj.multiCall([1, 2, 3], [4, 5, 6])).rejects.toBe("RejectionSimulation triggered");
        });

        test("should NOT cache rejections in multiCall (retry-friendly)", async () => {
            const tester = generateTester({cacheProvider: memoryCP});

            // Clear any cached values
            await tester.testObj.demoize(1, 2, 3);
            await tester.testObj.demoize(4, 5, 6);

            // Enable rejection simulation
            tester.simulateRejection(true);

            // Test that multiCall rejects when function fails
            await expect(tester.testObj.multiCall([1, 2, 3], [4, 5, 6])).rejects.toBe("RejectionSimulation triggered");

            // Disable rejection - second call should succeed immediately
            // This is the desired behavior: rejections are NOT cached in multiCall
            tester.simulateRejection(false);
            tester.reset();

            // This call should succeed because rejections were NOT cached
            const result = await tester.testObj.multiCall([1, 2, 3], [4, 5, 6]);
            expect(result).toEqual([6, 15]);
            expect(tester.wasLastCallAHit).toBe(false); // Function executed (not from cache)

            // Verify that single call DOES cache rejections (for comparison)
            tester.simulateRejection(true);
            await expect(tester.testObj.call(7, 8, 9)).rejects.toBe("RejectionSimulation triggered");

            tester.simulateRejection(false);
            tester.reset();

            // Single call returns cached rejection
            await expect(tester.testObj.call(7, 8, 9)).rejects.toBe("RejectionSimulation triggered");
            expect(tester.wasLastCallAHit).toBe(true); // Rejection was cached
        });

        test("should handle cache key generation with order variation", async () => {
            const tester = generateTester({cacheProvider: memoryCP, argsOrderVain: true});
            await tester.testObj.call(3, 2, 1);
            tester.reset();
            await tester.testObj.call(1, 2, 3);
            expect(tester.wasLastCallAHit).toBe(true);
        });

        test("should handle serialization", async () => {
            const tester = generateTester({cacheProvider: memoryCP});
            const complexObject = {a: [1, 2, 3], b: {c: "test"}};
            await tester.testObj.update(1, complexObject);
            const result = await tester.testObj.call(1);
            expect(result).toEqual(complexObject);
        });

        test("should handle BigInt serialization", async () => {
            const tester = generateTester({cacheProvider: memoryCP});
            const dbRecord = {
                id: BigInt(9007199254740991),
                name: "Test Record",
                timestamp: BigInt(1682536789123)
            };

            await tester.testObj.update(2, dbRecord);
            const result = await tester.testObj.call(2);

            expect(typeof result.id).toBe('bigint');
            expect(result.id).toBe(dbRecord.id);
            expect(typeof result.timestamp).toBe('bigint');
            expect(result.timestamp).toBe(dbRecord.timestamp);
        });

        test("should handle multi operations with override", async () => {
            const tester = generateTester({
                cacheProvider: memoryCP,
                multiExecOverride: async function (...argss: [number, number, number][]) {
                    return argss.map(args => args.reduce((acc, curr) => acc + curr, 0))
                }
            });
            const expectedResult = [6, 15];  // [1+2+3, 4+5+6]
            const result = await tester.testObj.multiExec([1, 2, 3], [4, 5, 6]);
            expect(result).toEqual(expectedResult);
        });
    });
});
