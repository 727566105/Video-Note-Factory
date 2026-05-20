import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(() => {
  const apiBaseUrl = process.env.API_PROXY_TARGET || `http://127.0.0.1:${process.env.BACKEND_PORT || '8483'}`
  const port = parseInt(process.env.VITE_FRONTEND_PORT || '3015', 10)

  return {
    base: './',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: port,
      allowedHosts: true,
      fs: {
        strict: false,
      },
      proxy: {
        '/api': {
          target: apiBaseUrl,
          changeOrigin: true,
          rewrite: path => path.replace(/^\/api/, '/api'),
        },
        '/static': {
          target: apiBaseUrl,
          changeOrigin: true,
          rewrite: path => path.replace(/^\/static/, '/static'),
        },
        '/uploads': {
          target: apiBaseUrl,
          changeOrigin: true,
        },
      },
    },
  }
})
