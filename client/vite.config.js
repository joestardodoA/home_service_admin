/**
 * vite.config.js — 管理后台前端构建配置
 *
 * ⚙️ 手动配置项:
 *   port   — 前端开发服务器端口，默认 5173
 *   target — 后端 API 地址，开发时指向 localhost:3001
 *            生产部署不需要 proxy，使用 Nginx 反向代理
 */
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
