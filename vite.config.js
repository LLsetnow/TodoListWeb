import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/fetch_tasks': 'http://localhost:3000',
      '/add_task': 'http://localhost:3000',
      '/delete_task': 'http://localhost:3000',
      '/toggle_complete': 'http://localhost:3000',
    },
  },
})
