import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const processBrowser = require.resolve('process/browser');

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'crypto', 'util', 'events', 'string_decoder', 'vm', 'stream'],
      globals: { Buffer: true, global: true, process: false },
      protocolImports: true,
    }),
  ],
  resolve: {
    alias: [
      { find: /^process\/browser$/, replacement: processBrowser },
      { find: /^process\/$/, replacement: processBrowser },
      { find: /^process$/, replacement: processBrowser },
    ],
  },
  optimizeDeps: {
    esbuild: {
      define: {
        global: 'globalThis',
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
});
