# Memoose-js

Memoization library with swappable cache providers. Write your caching logic once, swap the provider per environment.

| Provider | Import | Use case | Extra install |
|----------|--------|----------|---------------|
| `MemoryCacheProvider` | `memoose-js` | Development, single-process apps | None |
| `DisabledCacheProvider` | `memoose-js` | Tests, debugging (cache passthrough) | None |
| `RedisCacheProvider` | `memoose-js/redis` | Production, multi-process/multi-server | `ioredis` |
| `RedisClusterCacheProvider` | `memoose-js/redis` | Production with Redis Cluster | `ioredis` |

All providers implement the same `CacheProvider` interface — your business logic doesn't change between environments.

## Key Features

- **Swappable Cache Providers**: Memory, Redis, Redis Cluster, or disabled — same `CacheProvider` interface across environments
- **TTL Support**: Configurable time-to-live on cached results
- **Batch Operations**: `multiCall` fetches many keys at once, only computing cache misses
- **Custom Serialization**: Handle BigInt, Date, or custom objects with pluggable serializers
- **Cache Key Generation**: Deterministic keys from function arguments, with optional order-insensitive mode
- **TypeScript**: Full type support

## Installation

```bash
npm install memoose-js
```

To use Redis cache providers, also install `ioredis`:

```bash
npm install ioredis
```

## v3.0.0 Breaking Changes

**ESM-only**: Memoose-js v3.0.0 no longer supports CommonJS. Use ES modules with `import` statements.

**Redis imports moved**: Import Redis providers from the `memoose-js/redis` subpath:

```typescript
// v3.0.0+
import { Memoize, MemoryCacheProvider } from 'memoose-js';
import { RedisCacheProvider, RedisClusterCacheProvider } from 'memoose-js/redis';
```

**Simplified dependencies**: `mongoose` is no longer a peer dependency. `ioredis` is optional and only required for `memoose-js/redis`.

## Usage

### Basic Example

```typescript
import { Memoize, MemoryCacheProvider } from 'memoose-js';

function computeSum(...numbers) {
  return numbers.reduce((sum, num) => sum + num, 0);
}

const memoryCacheProvider = new MemoryCacheProvider();
const memoizedSum = new Memoize(computeSum, 10, {
  cacheProvider: memoryCacheProvider
});

async function testMemoization() {
  const result1 = await memoizedSum.call(1, 2, 3);
  console.log('First call:', result1);  // Computes and caches

  const result2 = await memoizedSum.call(1, 2, 3);
  console.log('Second call:', result2);  // Returns from cache
}

testMemoization();
```

### Advanced Example: Redis with Custom Serialization

Handle BigInt and other complex types with Redis:

```typescript
import { Memoize } from 'memoose-js';
import { RedisCacheProvider } from 'memoose-js/redis';
import type { SerializationOptions } from 'memoose-js';

const bigIntSerialization: SerializationOptions = {
  serializer: (key, value) => {
    if (typeof value === 'bigint') return `__BIGINT__${value.toString()}`;
    return value;
  },
  deserializer: (key, value) => {
    if (typeof value === 'string' && value.startsWith('__BIGINT__')) {
      return BigInt(value.substring(10));
    }
    return value;
  }
};

const redisProvider = new RedisCacheProvider(
  "myapp",
  { host: "localhost", port: 6379 },
  true,
  bigIntSerialization
);

async function getUserById(id: bigint) {
  return {
    id,
    name: "User " + id.toString(),
    created: BigInt(Date.now())
  };
}

const memoizedGetUser = new Memoize(getUserById, 300, {
  cacheProvider: redisProvider
});

const user = await memoizedGetUser.call(BigInt(123456789012345));
console.log(user.id); // BigInt preserved
```

## Contributing

We welcome contributions from the community. Please feel free to submit feature enhancements, bug fixes, documentation updates, or test improvements.
