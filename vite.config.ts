import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // 正式打包會被部署在非根路徑(/ImcCardPlatformAdmin，見ImcCardPlatformAdminShell)，
  // 資源路徑(<script src>等)要帶這個前綴，否則瀏覽器會直接去網域根目錄找、404。
  // 本機dev server(4001)不受影響，繼續用根路徑，維持既有開發流程不變。
  base: command === 'build' ? '/ImcCardPlatformAdmin/' : '/',
  plugins: [react()],
  server: {
    // 3000/3001被打卡RWD前端(ImcCardPlatformFrontend)佔用、且落在Windows(Hyper-V/WSL2)
    // 動態保留的TCP連接埠範圍內會導致listen EACCES，這裡改用4001避開。
    port: 4001,
    proxy: {
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
    },
  },
}))
