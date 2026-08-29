import axios from 'axios'

export const apiClient = axios.create({
  baseURL: '/api',
})

export function clearSessionAndRedirectToLogin() {
  localStorage.removeItem('platformToken')
  localStorage.removeItem('platformChname')
  localStorage.removeItem('platformMustChangePassword')
  localStorage.removeItem('platformOperatingCompanyId')
  localStorage.removeItem('platformOperatingCompanyName')
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
