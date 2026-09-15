import { useEffect, useRef } from 'react'
import { message } from 'antd'
import { apiClient, clearSessionAndRedirectToLogin } from '../api/client'

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'] as const
// 遠低於timeoutMs(10分鐘)，確保只要使用者在這段時間內還有任何操作，就一定能在token真正過期前續上一次。
const REFRESH_CHECK_INTERVAL_MS = 2 * 60 * 1000

/**
 * 閒置達 timeoutMs 沒有任何操作就主動登出、導回登入頁，不等下一次API呼叫才被動觸發401。
 * 逾時秒數要跟後端 app.jwt.expiration-ms 保持一致，這樣被踢出的時機才會跟token實際失效的時機吻合。
 *
 * 另外背景定期幫token續期(見REFRESH_CHECK_INTERVAL_MS)：token的到期時間是從登入那一刻開始算的
 * 絕對時間，跟畫面上有沒有在操作無關，只看有沒有真的送出API——如果沒有這段續期邏輯，使用者
 * 即使一直在操作(填表單、切分頁)，只要中間剛好超過10分鐘沒送出任何API，token仍會在背景默默過期，
 * 下一次送出請求時才會被後端401、無預警登出，使用者會覺得莫名其妙。
 */
export function useIdleLogout(timeoutMs: number, enabled: boolean) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const lastActivityRef = useRef(Date.now())

  useEffect(() => {
    if (!enabled) return

    const logout = () => {
      message.warning('閒置過久，請重新登入')
      clearSessionAndRedirectToLogin()
    }

    const resetTimer = () => {
      lastActivityRef.current = Date.now()
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(logout, timeoutMs)
    }

    resetTimer()
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer))

    const refreshInterval = setInterval(() => {
      // 只有「距離上次操作還在timeoutMs之內(代表不是閒置狀態)」才續期，真正閒置的使用者
      // 讓上面的logout()計時器去處理，不需要幫一個沒在用的session續期。
      if (Date.now() - lastActivityRef.current >= timeoutMs) return
      apiClient
        .post<{ token: string }>('/auth/refresh')
        .then((res) => localStorage.setItem('platformToken', res.data.token))
        .catch(() => {
          // 續期失敗(通常代表token已經先一步失效)，交給下一次API呼叫的401攔截器處理登出即可，這裡不用重複動作。
        })
    }, REFRESH_CHECK_INTERVAL_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      clearInterval(refreshInterval)
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer))
    }
  }, [timeoutMs, enabled])
}
