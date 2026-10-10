import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// サブパスで配信する場合のみ BASE_PATH を指定（Vercel はルート配信のため不要）
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
})
