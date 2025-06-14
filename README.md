# Memoose-js

**Memoose-js** is a versatile memoization library designed to optimize performance in JavaScript applications by caching
the results of expensive function calls. This package efficiently reduces the frequency of repeated computations,
speeding up overall application responsiveness and reducing server load.

## Key Features

- **Time-to-Live (TTL) Support**: Customize the lifespan of cached results with a configurable TTL, ensuring your data
  remains up-to-date.
- **Versatile Cache Providers**: Integrates seamlessly with various caching backends, including Redis and in-memory
  solutions, offering flexibility for different operational environments.
- **Concurrency Management**: Built-in mechanisms handle concurrent accesses smoothly, maintaining data integrity and
  consistency across asynchronous operations.
- **Adaptive Cache Key Generation**: Features customizable cache key generation strategies to accommodate functions
  where the order of arguments is irrelevant to the output.
- **Custom Serialization Support**: Provides options for custom serializers and deserializers, making it easy to handle
  complex data types like BigInt, Date, or custom objects that aren't natively supported by JSON.
- **Batch Execution Support**: Enhances performance for batch operations through its multi-execution capabilities,
  reducing processing time and resource consumption.
- **Robust Error Handling**: Implements error management strategies to maintain application stability even when the
  cached functions fail.

## Why Use Memoose-js?

**Memoose-js** is ideal for developers looking to boost the efficiency of applications that rely heavily on data
processing and computation. Whether you're building complex web applications, APIs, or data-intensive backends,
memoose-js offers a straightforward way to introduce powerful caching strategies that are both scalable and easy to
implement.

## Contributing

We welcome contributions from the community! We appreciate any contributions,
whether they are feature enhancements, bug fixes, documentation updates, or test improvements.

### Sample Usage

Below is a simple example demonstrating how to use **Memoose-js** to memoize a function that computes the sum of its
arguments. This example uses an in-memory cache provider to store the results with a TTL (time-to-live) of 10 seconds.

```typescript
import { Memoize, MemoryCacheProvider, RedisCacheProvider, SerializationOptions } from 'memoose-js';

// Define a function to be memoized
function computeSum(...numbers) {
  return numbers.reduce((sum, num) => sum + num, 0);
}

// Create an instance of the MemoryCacheProvider
const memoryCacheProvider = new MemoryCacheProvider();

// Initialize Memoize with the function, a TTL of 10 seconds, and the memory cache provider
const memoizedSum = new Memoize(computeSum, 10, {
  cacheProvider: memoryCacheProvider
});

// Using the memoized function
async function testMemoization() {
  // First call: computes the result and caches it
  const result1 = await memoizedSum.call(1, 2, 3);
  console.log('First call result:', result1);  // Output: 6

  // Second call with the same arguments before TTL expires: retrieves result from cache
  const result2 = await memoizedSum.call(1, 2, 3);
  console.log('Second call result (from cache):', result2);  // Output: 6
}

testMemoization();
```

### Advanced Example: Custom Serialization with BigInt Support

When working with databases or other systems that use BigInt values, standard JSON serialization fails because BigInt isn't natively supported in JSON. Memoose-js solves this with custom serialization options:

```typescript
import { Memoize, RedisCacheProvider, SerializationOptions } from 'memoose-js';

// Custom serialization options for handling BigInt values
const bigIntSerializationOptions: SerializationOptions = {
  serializer: (key, value) => {
    // Convert BigInt to a specially formatted string
    if (typeof value === 'bigint') {
      return `__BIGINT__${value.toString()}`;
    }
    return value;
  },
  deserializer: (key, value) => {
    // Convert the formatted string back to BigInt
    if (typeof value === 'string' && value.startsWith('__BIGINT__')) {
      return BigInt(value.substring(10));
    }
    return value;
  }
};

// Create Redis provider with custom serialization
const redisProvider = new RedisCacheProvider(
  "myapp", 
  { host: "localhost", port: 6379 }, 
  true, 
  bigIntSerializationOptions
);

// Function that works with database records
async function getUserById(id) {
  // Normally this would fetch from a database
  return {
    id: BigInt(id),
    name: "User " + id,
    created: BigInt(Date.now())
  };
}

// Memoize the function with Redis cache
const memoizedGetUser = new Memoize(getUserById, 300, {
  cacheProvider: redisProvider
});

// Now you can safely work with BigInt values in your cached results
const user = await memoizedGetUser.call(123456789012345);
console.log(user.id); // BigInt value preserved

