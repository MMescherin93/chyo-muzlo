import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Алиас на исходники @muzlo/shared (монорепо, без отдельной сборки).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@muzlo/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
});
