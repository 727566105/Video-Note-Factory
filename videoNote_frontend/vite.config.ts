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
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // React 核心
            'react-core': ['react', 'react-dom', 'react-router-dom'],
            // UI 组件库
            'ui-radix': [
              '@radix-ui/react-dialog',
              '@radix-ui/react-select',
              '@radix-ui/react-tabs',
              '@radix-ui/react-tooltip',
              '@radix-ui/react-checkbox',
              '@radix-ui/react-switch',
              '@radix-ui/react-scroll-area',
            ],
            // Ant Design（大型库，单独分包）
            'antd': ['antd'],
            // 图标库（大型库）
            'icons': ['@lobehub/icons', 'lucide-react'],
            // Markdown 相关
            'markdown': [
              'react-markdown',
              'remark-gfm',
              'remark-math',
              'rehype-katex',
              'katex',
              '@uiw/react-markdown-preview',
            ],
            // Markmap 脑图
            'markmap': ['markmap-lib', 'markmap-view', 'markmap-toolbar', 'markmap-common'],
            // 状态管理
            'zustand': ['zustand'],
            // 工具库
            'utils': ['axios', 'clsx', 'tailwind-merge', 'class-variance-authority'],
            // 其他大型依赖
            'misc': ['html2canvas', 'react-syntax-highlighter', 'opencc-js'],
          },
        },
      },
      // 提高 chunk 大小警告阈值
      chunkSizeWarningLimit: 1000,
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
