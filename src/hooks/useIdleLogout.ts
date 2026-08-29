import { useEffect, useRef } from 'react'
import { message } from 'antd'
import { clearSessionAndRedirectToLogin } from '../api/client'

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const

/**
 * 閒置達 timeoutMs 沒有任何操作就主動登出、導回登入頁，不等下一次API呼叫才被動觸發401。
 * 逾時秒數要跟後端 app.jwt.expiration-ms 保持一致，這樣被踢出的時機才會跟token實際失效的時機吻合。
 */
export function useIdleLogout(timeoutMs: number, enabled: boolean) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!enabled) return

    const logout = () => {
      message.warning('閒置過久，請重新登入')
      clearSessionAndRedirectToLogin()
    }

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(logout, timeoutMs)
    }

    resetTimer()
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer))

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer))
    }
  }, [timeoutMs, enabled])
}
