import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// In http mode the browser calls "/api/..." on this dev server, and Vite forwards it to the backend.
// That avoids CORS problems while developing. Change the target in .env (VITE_PROXY_TARGET).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_PROXY_TARGET || 'http://localhost:8080';
  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      proxy: { '/api': { target, changeOrigin: true } },
    },
  };
});
