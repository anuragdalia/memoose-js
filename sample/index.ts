import {Memoize, MemoryCacheProvider, RedisCacheProvider} from "../dist";
import {MemoizeConfig} from "../dist/";


const redisCP = new RedisCacheProvider("redis", {lazyConnect: true}, true);
const memoryCP = new MemoryCacheProvider()

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

function assert(condition: boolean, successMessage: string, failureMessage: string) {
    const green = '\x1b[32m%s\x1b[0m'; // Green color
    const red = '\x1b[31m%s\x1b[0m';   // Red color

    if (condition) {
        console.log(green, successMessage);
    } else {
        console.error(red, failureMessage);
    }
}

async function testSerialization(memoizeConfig: MemoizeConfig) {
    const tester = generateTester(memoizeConfig);
    const complexObject = {a: [1, 2, 3], b: {c: "test"}};
    await tester.testObj.update(1, complexObject);
    const result = await tester.testObj.call(1);
    assert(JSON.stringify(result) === JSON.stringify(complexObject), "Serialization Test Success", "Serialization Test Failed");
    tester.reset();
}

async function testCacheKeyGeneration(memoizeConfig: MemoizeConfig) {
    const tester = generateTester(memoizeConfig);
    await tester.testObj.call(3, 2, 1);
    tester.reset();
    await tester.testObj.call(1, 2, 3);
    assert(tester.wasLastCallAHit, "Cache Key Generation Test Success", "Cache Key Generation Test Failed");
    tester.reset();
}

async function testSingle(memoizeConfig: MemoizeConfig) {
    const tester = generateTester(memoizeConfig);

    // Expected results for clarity
    const expectedResult = 6;  // 1 + 2 + 3
    const updatedValue = 999;  // Updated value for test

    // Test `call` function: Cache miss
    const r1 = await tester.testObj.call(1, 2, 3);
    assert(r1 === expectedResult, "Test Call (Miss) Success", "Test Call (Miss) Failed");
    tester.reset();

    // Test `call` function: Cache hit
    const r2 = await tester.testObj.call(1, 2, 3);
    assert(r2 === expectedResult && tester.wasLastCallAHit, "Test Call (Hit) Success", "Test Call (Hit) Failed");
    tester.reset();

    // Test `exec` function: Bypassing cache
    const r3 = await tester.testObj.exec(1, 2, 3);
    assert(r3 === expectedResult, "Test Exec Success", "Test Exec Failed");
    tester.reset();

    // Test `update` function
    await tester.testObj.update(1, 2, 3, updatedValue);
    const r4 = await tester.testObj.call(1, 2, 3);
    assert(r4 === updatedValue, "Test Update Success", "Test Update Failed");
    tester.reset();

    // Test `demoize` function
    await tester.testObj.demoize(1, 2, 3);
    await sleep(500);
    const r5 = await tester.testObj.call(1, 2, 3);
    assert(r5 === expectedResult && !tester.wasLastCallAHit, "Test Demoize Success", "Test Demoize Failed");
    tester.reset();

    // Test `refresh` function
    await tester.testObj.refresh(1, 2, 3);
    const r6 = await tester.testObj.call(1, 2, 3);
    assert(r6 === expectedResult, "Test Refresh Success", "Test Refresh Failed");
    tester.reset();

    // Test `setExp` function
    await tester.testObj.setExp(1, 2, 3, 1);  // Setting TTL to 1 second
    await sleep(4000);  // Wait for the cache to expire
    const r7 = await tester.testObj.call(1, 2, 3);
    assert(r7 === expectedResult && !tester.wasLastCallAHit, "Test SetExp Success", "Test SetExp Failed");
    tester.reset();

    console.log("All tests completed.");
}

async function testMulti<R extends Array<any> = any[], T = any>(memoizeConfig: MemoizeConfig<R, T>) {
    const tester = generateTester<R, T>(memoizeConfig);


    const expectedResultMultiExec = [6, 15];  // [1+2+3, 4+5+6]

    // Test `multiExec`
    const r8 = await tester.testObj.multiExec([1, 2, 3] as R, [4, 5, 6] as R);
    assert(JSON.stringify(r8) === JSON.stringify(expectedResultMultiExec), "Test MultiExec Success", "Test MultiExec Failed");
    tester.reset();

    // Test `multiCall` function: Cache miss
    const r10 = await tester.testObj.multiCall([1, 2, 3] as R, [4, 5, 6] as R);
    assert(JSON.stringify(r10) === JSON.stringify(expectedResultMultiExec), "Test MultiCall (Miss) Success", "Test MultiCall (Miss) Failed");
    tester.reset();

    // Test `multiCall` function: Cache hit
    const r11 = await tester.testObj.multiCall([1, 2, 3] as R, [4, 5, 6] as R);
    assert(JSON.stringify(r11) === JSON.stringify(expectedResultMultiExec) && tester.wasLastCallAHit, "Test MultiCall (Hit) Success", "Test MultiCall (Hit) Failed");
    tester.reset();

    // Simulate rejection scenario
    await tester.testObj.demoize(...[1, 2, 3] as R)
    tester.simulateRejection(true);
    try {
        await tester.testObj.multiCall([1, 2, 3] as R, [4, 5, 6] as R);
        assert(false, "Test MultiCall Rejection Fail", "Test MultiCall Rejection Failed because it didnt reject");
    } catch (error) {
        assert(error === "RejectionSimulation triggered", "Test MultiCall Rejection Success", "Test MultiCall Rejection Failed");
    }
    tester.reset();
}

async function testAll() {
    await redisCP.flushdb()
    await testSingle({cacheProvider: redisCP});
    await memoryCP.flushdb()
    await testSingle({cacheProvider: memoryCP});

    await redisCP.flushdb()
    await testMulti({cacheProvider: redisCP})
    await memoryCP.flushdb()
    await testMulti({cacheProvider: memoryCP})

    await redisCP.flushdb()
    await testMulti({
        cacheProvider: redisCP,
        multiExecOverride: async function (...argss: number[][]) {
            return argss.map(args => args.reduce((acc, curr) => acc + curr, 0))
        }
    })
    await memoryCP.flushdb()

    const config1: MemoizeConfig<[number, number, number]> = {
        cacheProvider: memoryCP,
        multiExecOverride: async function (...argss: [number, number, number][]) {
            return argss.map(args => args.reduce((acc, curr) => acc + curr, 0))
        }
    }
    const config2: MemoizeConfig<number[]> = {
        cacheProvider: memoryCP,
        multiExecOverride: async function (...argss: number[][]) {
            return argss.map(args => args.reduce((acc, curr) => acc + curr, 0))
        }
    }
    await testMulti({
        cacheProvider: memoryCP,
        multiExecOverride: async function (...argss: [number, number, number][]) {
            return argss.map(args => args.reduce((acc, curr) => acc + curr, 0))
        }
    })

    await redisCP.flushdb()
    await testCacheKeyGeneration({cacheProvider: redisCP, argsOrderVain: true})
    await memoryCP.flushdb()
    await testCacheKeyGeneration({cacheProvider: memoryCP, argsOrderVain: true})

    await redisCP.flushdb()
    await testSerialization({cacheProvider: redisCP})
    await memoryCP.flushdb()
    await testSerialization({cacheProvider: memoryCP})
}

testAll()
