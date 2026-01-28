import {defineConfig} from 'vite';
import dts from 'vite-plugin-dts';
import {resolve} from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'MemooseJS',
            fileName: (format) => format === 'es' ? 'index.mjs' : 'index.js',
            formats: ['es', 'cjs']
        },
        rollupOptions: {
            external: ['lodash', 'object-hash', 'ioredis', 'mongoose', '@vercel/kv'],
            output: {
                preserveModules: false,
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