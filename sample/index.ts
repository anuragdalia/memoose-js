import {Memoize, MemoryCacheProvider, RedisCacheProvider} from "../dist";

function squareOf(param: number) {
    console.log("Computing square of", param)
    return Math.pow(param, 2);
}

Memoize.config.MemoryCacheProvider = new MemoryCacheProvider()
Memoize.config.RedisCacheProvider = new RedisCacheProvider("sample", {lazyConnect: true})

const cachedSquareOf = new Memoize(squareOf, 300, {})

async function main() {
    async function f(n: number) {
        console.log(`Square of ${n} is`, await cachedSquareOf.call(n))
    }

    await f(10)
    await f(20)
    await f(10)
}

main()
