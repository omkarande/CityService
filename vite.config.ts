/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { probeApiPlugin } from './scripts/vite-probe-plugin.js';

export default defineConfig({
  // Capacitor 7 serves the Android WebView at https://localhost, so '/' works
  // there and keeps nested website routes (e.g. /l/:id) loading /assets.
  base: '/',
  plugins: [react(), probeApiPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true, // so you can open it on your phone over the LAN
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
