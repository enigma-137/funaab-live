import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Every build gets an id, baked into the app and published as /version.json. A running game that
// sees a different id knows a newer version is live and offers a refresh.
const BUILD_ID = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const versionFile = () => ({
  name: 'funaab-version-file',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID }) });
  },
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), versionFile()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/campus-summary': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/announcement': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/api/ws': {
        target: 'ws://localhost:8787',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
