import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Алиас на исходники @muzlo/shared (монорепо, без отдельной сборки).
// В dev-режиме /api и /ws проксируются на локальный хост-сервер (server/index.mjs),
// поэтому удобно запускать: `node server/index.mjs` + `npm run dev`.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@muzlo/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  server: {
    host: true,
    proxy: {
      '/api': 'http://localhost:8080',
      '/ws': { target: 'ws://localhost:8080', ws: true },
    },
  },
});
