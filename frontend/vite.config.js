import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxies /api to the Express backend in dev so the frontend can call
// relative paths without hardcoding a host.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
