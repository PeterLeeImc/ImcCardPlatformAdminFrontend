import { getImcFrontendHost } from '../api/config'

/**
 * 各清單頁的編號超連結，點了直接開IMC系統對應的詳細頁面。IMC前端網址本機測試/正式環境不同，
 * 由後端app.imc-system.frontend-host設定、App啟動時抓一次(見api/config.ts)，這裡不寫死。
 */
export function imcCustomerDetailUrl(serial: string): string {
  return `${getImcFrontendHost()}/customers/detail/${encodeURIComponent(serial)}`
}

export function imcDispatchCaseDetailUrl(serial: string): string {
  return `${getImcFrontendHost()}/dispatchCase/detail/${encodeURIComponent(serial)}`
}

export function imcEmployeeDetailUrl(serial: string): string {
  return `${getImcFrontendHost()}/employee/detail/${encodeURIComponent(serial)}`
}
