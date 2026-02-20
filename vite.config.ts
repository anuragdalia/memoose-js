import {defineConfig} from 'vite';
import dts from 'vite-plugin-dts';
import {resolve} from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: {
                'index': resolve(__dirname, 'src/index.ts'),
                'redis': resolve(__dirname, 'src/redis.ts'),
            },
            fileName: (format, entryName) => `${entryName}.js`,
            formats: ['es']
        },
        rollupOptions: {
            external: ['lodash', 'object-hash', 'ioredis', '@vercel/kv'],
            output: {
                exports: 'named'
            }
        },
        target: 'node14',
        minify: false
    },
    plugins: [dts({
        insertTypesEntry: true,
        rollupTypes: true
    })]
});