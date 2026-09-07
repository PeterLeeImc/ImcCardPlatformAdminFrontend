import axios from 'axios'

export const apiClient = axios.create({
  baseURL: '/api',
})

/** 顧問(role=004)只能依資料範圍查看被指派的客戶/派遣個案/員工資料，不能新增，各清單頁的
 * 「新增」按鈕用這個判斷是否要disabled。 */
export function isAdvisorRole(): boolean {
  return localStorage.getItem('platformRole') === '004'
}

export function clearSessionAndRedirectToLogin() {
  localStorage.removeItem('platformToken')
  localStorage.removeItem('platformChname')
  localStorage.removeItem('platformMustChangePassword')
  localStorage.removeItem('platformOperatingCompanyId')
  localStorage.removeItem('platformOperatingCompanyName')
  localStorage.removeItem('platformRole')
  window.location.href = '/login'
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
