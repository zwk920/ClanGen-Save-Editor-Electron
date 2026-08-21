import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    base: './',
    define: {
        'import.meta.env.VITE_WEB_MODE': JSON.stringify('false'),
    },
    build: {
        outDir: 'dist-renderer',
    },
    plugins: [react()],
    server: {
        port: 5173,
        host: '127.0.0.1',
    },
});
