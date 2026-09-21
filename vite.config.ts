import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // 正式打包會被部署在非根路徑(/ImcCardPlatformAdmin，見ImcCardPlatformAdminShell)，
  // 資源路徑(<script src>等)要帶這個前綴，否則瀏覽器會直接去網域根目錄找、404。
  // 本機dev server(24001)不受影響，繼續用根路徑，維持既有開發流程不變。
  base: command === 'build' ? '/ImcCardPlatformAdmin/' : '/',
  plugins: [react()],
  server: {
    // Windows(WinNAT，Hyper-V/WSL2/Docker)每次開機會在TCP動態埠號範圍內保留一批埠，這台電腦的
    // 動態範圍被設成1024-15000(非預設)，3000/3001/4000/4001都曾落進保留範圍導致listen EACCES。
    // 改用範圍外的24001(需與ImcCardPlatformFrontend的24000錯開)。
    port: 24001,
    proxy: {
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
    },
  },
}))
