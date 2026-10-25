import { defineConfig, loadEnv, searchForWorkspaceRoot } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const contracts = path.resolve(__dirname, '../backend/src/contracts');

// The browser always calls same-origin /api/v1. Only this dev server knows where the backend is.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = process.env.API_PROXY_TARGET || env.API_PROXY_TARGET || 'http://127.0.0.1:3000';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@contracts': contracts,
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      fs: { allow: [searchForWorkspaceRoot(process.cwd()), contracts] },
      proxy: { '/api': { target, changeOrigin: true } },
    },
    preview: {
      proxy: { '/api': { target, changeOrigin: true } },
    },
  };
});
