import axios from 'axios'

export const apiClient = axios.create({
  baseURL: '/api',
})

/** 顧問(role=004)只能依資料範圍查看被指派的客戶/派遣個案/員工資料，不能新增，各清單頁的
 * 「新增」按鈕用這個判斷是否要disabled。 */
export function isAdvisorRole(): boolean {
  return localStorage.getItem('platformRole') === '004'
}

/** 系統管理者(role=001)專用功能(例如首頁「預設資料庫」)用這個判斷是否要顯示，後端也會再檢查一次角色。 */
export function isSystemAdminRole(): boolean {
  return localStorage.getItem('platformRole') === '001'
}

/** 顧問在「選擇客戶」目前選到樣板客戶(Company.template)時，不允許編輯/刪除清單裡的資料，
 * 避免顧問誤改到全系統共用的樣板設定；系統管理者/系統使用者不受此限制。 */
export function isAdvisorEditingTemplateCompany(
  companies: { id: number; template: boolean }[],
  companyId: number | undefined,
): boolean {
  return isAdvisorRole() && !!companies.find((c) => c.id === companyId)?.template
}

/** 「選擇客戶」下拉選單排序：樣板客戶固定排到最後面，避免跟一般客戶混在一起容易選錯；
 * 用穩定排序(Array.sort在現代JS引擎保證穩定)，同組內維持原本(後端已排序好)的順序。 */
export function sortCompaniesTemplateLast<T extends { template: boolean }>(companies: T[]): T[] {
  return [...companies].sort((a, b) => Number(a.template) - Number(b.template))
}

export function clearSessionAndRedirectToLogin() {
  localStorage.removeItem('platformToken')
  localStorage.removeItem('platformAccount')
  localStorage.removeItem('platformChname')
  localStorage.removeItem('platformMustChangePassword')
  localStorage.removeItem('platformOperatingCompanyId')
  localStorage.removeItem('platformOperatingCompanyName')
  localStorage.removeItem('platformOperatingDispatchCaseId')
  localStorage.removeItem('platformOperatingDispatchCaseCompanyId')
  localStorage.removeItem('platformOperatingDispatchCaseLabel')
  localStorage.removeItem('platformRole')
  // 用瀏覽器導頁(不是React Router的Navigate)，所以要自己補上BASE_URL前綴：正式打包部署在
  // 非根路徑(/ImcCardPlatformAdmin/)時，寫死的絕對路徑"/login"會導去網域根目錄(打卡RWD員工端
  // 的登入頁)，不是這個SPA自己的登入頁，這裡要跟App.tsx的BrowserRouter basename保持一致。
  window.location.href = `${import.meta.env.BASE_URL}login`
}

/** 「目前操作個案」變更時觸發的事件名稱：PageHeader訂閱這個事件即時更新頁首顯示，
 * 不用等使用者換頁重新掛載PageHeader才看得到最新值(localStorage本身不會觸發同分頁的re-render)。 */
export const OPERATING_DISPATCH_CASE_CHANGED_EVENT = 'platform-operating-dispatch-case-changed'

/** 登入或在「個案維護」清單按[設定個案]時呼叫，統一負責寫入localStorage+通知PageHeader更新。
 * id/companyId/label同時為null代表清空(目前沒有任何登入回應或操作會這樣做，但保留這個彈性)。 */
export function setOperatingDispatchCase(id: number | null, companyId: number | null, label: string | null) {
  if (id != null && companyId != null && label != null) {
    localStorage.setItem('platformOperatingDispatchCaseId', String(id))
    localStorage.setItem('platformOperatingDispatchCaseCompanyId', String(companyId))
    localStorage.setItem('platformOperatingDispatchCaseLabel', label)
  } else {
    localStorage.removeItem('platformOperatingDispatchCaseId')
    localStorage.removeItem('platformOperatingDispatchCaseCompanyId')
    localStorage.removeItem('platformOperatingDispatchCaseLabel')
  }
  window.dispatchEvent(new Event(OPERATING_DISPATCH_CASE_CHANGED_EVENT))
}

/** 「選擇客戶」/「選擇個案」清單頁初次載入時，預設要選哪家客戶/哪個個案，優先用「目前操作個案」
 * (若該客戶/個案還在目前抓到的清單裡)，找不到才退回清單第一筆——比照既有各頁「預設選第一筆」的慣例。 */
export function getOperatingDispatchCase(): { id: number; companyId: number } | null {
  const idStr = localStorage.getItem('platformOperatingDispatchCaseId')
  const companyIdStr = localStorage.getItem('platformOperatingDispatchCaseCompanyId')
  if (!idStr || !companyIdStr) {
    return null
  }
  return { id: Number(idStr), companyId: Number(companyIdStr) }
}

/** 客戶清單載入後決定預設選哪家客戶：優先用「目前操作個案」所屬的客戶(若還在這次抓到的清單裡)，
 * 找不到才退回清單第一筆。 */
export function resolveDefaultCompanyId(companies: { id: number }[]): number | undefined {
  const operating = getOperatingDispatchCase()
  if (operating && companies.some((c) => c.id === operating.companyId)) {
    return operating.companyId
  }
  return companies.length > 0 ? companies[0].id : undefined
}

/** 個案清單載入後決定預設選哪個個案：只有目前選擇的客戶正好是「目前操作個案」所屬的客戶時，
 * 才會用那個個案當預設值，否則(選了別家客戶)一律退回清單第一筆，不會跨客戶硬套用。 */
export function resolveDefaultDispatchCaseId(
  cases: { id: number }[],
  companyId: number | undefined,
): number | undefined {
  const operating = getOperatingDispatchCase()
  if (operating && operating.companyId === companyId && cases.some((d) => d.id === operating.id)) {
    return operating.id
  }
  return cases.length > 0 ? cases[0].id : undefined
}


apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('platformToken')
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearSessionAndRedirectToLogin()
    }
    return Promise.reject(error)
  },
)
