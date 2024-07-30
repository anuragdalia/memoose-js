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
import { Memoize, MemoryCacheProvider } from 'memoose-js';

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

