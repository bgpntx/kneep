import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    // Load all env vars (not just VITE_ prefixed)
    const env = loadEnv(mode, process.cwd(), '');

    return {
        plugins: [react()],
        define: {
            // Expose existing .env vars to the frontend
            '__LASTFM_API_KEY__': JSON.stringify(env.LASTFM_API_KEY || ''),
            '__LASTFM_USERNAME__': JSON.stringify(env.LASTFM_USERNAME || ''),
            '__ANTHROPIC_API_KEY__': JSON.stringify(env.ANTHROPIC_API_KEY || ''),
        },
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
    };
});
