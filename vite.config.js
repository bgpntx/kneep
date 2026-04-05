import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        // Proxy API calls to local Navidrome instance during development
        proxy: {
            '/rest': {
                target: 'http://localhost:4533',
                changeOrigin: true,
            },
            '/lastfm': {
                target: 'https://ws.audioscrobbler.com/2.0',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/lastfm/, ''),
            },
            '/anthropic': {
                target: 'https://api.anthropic.com',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/anthropic/, ''),
            },
        },
    },
    build: {
        outDir: 'dist',
        sourcemap: false,
    },
});
