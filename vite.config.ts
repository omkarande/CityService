/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { probeApiPlugin } from './scripts/vite-probe-plugin.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const useApi = env.VITE_USE_API === 'true';

  return {
    // Capacitor 7 serves the Android WebView at https://localhost, so '/' works
    // there and keeps nested website routes (e.g. /l/:id) loading /assets.
    base: '/',
    plugins: [react(), ...(useApi ? [] : [probeApiPlugin()])],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      host: true, // so you can open it on your phone over the LAN
      proxy: useApi
        ? {
            '/api': {
              target: env.VITE_API_BASE || 'http://127.0.0.1:3000',
              changeOrigin: true,
            },
          }
        : undefined,
    },
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
