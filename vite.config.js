import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs'; 
import path from 'path';

const isCI = process.env.CI === 'true';
const isProd = process.env.NODE_ENV === 'production';

export default defineConfig({
  plugins: [react()],
  server: {
    host: 'local.app.spring25a.secoder.net',
    port: 5173,
    strictPort: true,
    ...(isCI || isProd
      ? {} 
      : {
          https: {
            key: fs.readFileSync(path.resolve(__dirname, 'local.app.spring25a.secoder.net-key.pem')),
            cert: fs.readFileSync(path.resolve(__dirname, 'local.app.spring25a.secoder.net.pem')),
          },
          hmr: {
            host: 'local.app.spring25a.secoder.net',
          },
        }),
  },
  build: {
    outDir: 'dist',
  },
});