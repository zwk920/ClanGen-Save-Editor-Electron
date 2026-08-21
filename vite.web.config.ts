import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

const renameWebEntry = {
  name: 'rename-web-entry',
  closeBundle() {
    const outputDirectory = resolve(__dirname, 'dist-web');
    copyFileSync(resolve(outputDirectory, 'web.html'), resolve(outputDirectory, 'index.html'));
  },
};

export default defineConfig({
  base: './',
  define: {
    'import.meta.env.VITE_WEB_MODE': JSON.stringify('true'),
  },
  build: {
    outDir: 'dist-web',
    rollupOptions: {
      input: {
        index: 'web.html',
      },
    },
  },
  plugins: [react(), renameWebEntry],
});