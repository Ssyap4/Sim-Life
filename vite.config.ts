import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5175,
    strictPort: true,
    proxy: {
      '/sync': {
        target: 'ws://127.0.0.1:' + Number(process.env.PORT || 3111),
        ws: true,
        changeOrigin: false,
      },
    },
  },
});
