import { apiClient } from './client'

// 尚未跟後端要到設定值前的預設值(本機開發用)，避免App剛啟動、還沒fetch完成前超連結是空的。
let imcFrontendHost = 'http://localhost:3333'

export function getImcFrontendHost(): string {
  return imcFrontendHost
}

/** App啟動時(已登入)呼叫一次即可，之後isTemplate/hidden之類的清單頁面直接讀getImcFrontendHost()。 */
export async function loadAdminConfig(): Promise<void> {
  try {
    const res = await apiClient.get<{ imcFrontendHost: string }>('/admin/config')
    if (res.data.imcFrontendHost) {
      imcFrontendHost = res.data.imcFrontendHost
    }
  } catch {
    // 讀取失敗就維持預設值，不影響其他功能運作
  }
}
