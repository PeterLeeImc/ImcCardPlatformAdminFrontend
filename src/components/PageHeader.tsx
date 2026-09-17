import { type ReactNode, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Space } from 'antd'
import { LogoutOutlined } from '@ant-design/icons'
import { clearSessionAndRedirectToLogin, OPERATING_DISPATCH_CASE_CHANGED_EVENT } from '../api/client'

/**
 * 全部功能頁面共用的頁首：左邊頁面標題、中間「首頁」連結+目前使用者身分+目前操作個案+登出、
 * 右邊該頁面專屬的操作按鈕(例如「新增客戶」)。原本只有首頁(Home.tsx)有身分/登出區塊，其他功能頁
 * 進去之後看不到自己是誰、也無法直接登出，統一抽成這個共用元件讓每個功能頁都套用，不用各自複製
 * 貼上、以後也不會漏改。三欄都用flex:1讓中間區塊視覺上盡量置中，不因為左右兩側內容寬度不同而偏移太多。
 * 顯示格式統一採用「帳號 姓名」，例如 imcPeter 李宏志，方便跟其他畫面(操作記錄等)的帳號對照。
 * 「目前操作個案」跟身分不同，是使用者在「個案維護」清單主動按[設定個案]才會改變的值(不是登入時
 * 自動帶的預設值)，所以放在這裡顯示不會有「這個人只能操作這個個案」的誤會，之後需要「目前個案」
 * 的功能都會讀這個值。用localStorage存、custom event通知，這樣在「個案維護」按下設定的當下，
 * 不用整頁重新整理，頁首就能立即反映最新值。
 */
export default function PageHeader({ title, actions }: { title: ReactNode; actions?: ReactNode }) {
  const navigate = useNavigate()
  const account = localStorage.getItem('platformAccount') ?? ''
  const chname = localStorage.getItem('platformChname') ?? ''
  const displayName = account ? `${account} ${chname}` : chname

  const readOperatingDispatchCaseLabel = () => localStorage.getItem('platformOperatingDispatchCaseLabel')
  const [operatingDispatchCaseLabel, setOperatingDispatchCaseLabel] = useState(readOperatingDispatchCaseLabel)

  useEffect(() => {
    const onChange = () => setOperatingDispatchCaseLabel(readOperatingDispatchCaseLabel())
    window.addEventListener(OPERATING_DISPATCH_CASE_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(OPERATING_DISPATCH_CASE_CHANGED_EVENT, onChange)
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '16px 24px',
        background: '#fff',
        borderBottom: '1px solid #eee',
        gap: 16,
      }}
    >
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0 }}>
        {typeof title === 'string' ? (
          <span style={{ fontSize: 18, fontWeight: 600, whiteSpace: 'nowrap' }}>{title}</span>
        ) : (
          title
        )}
      </div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 }}>
        <Space size={16}>
          <a onClick={() => navigate('/')}>首頁</a>
          <span style={{ color: '#666', whiteSpace: 'nowrap' }}>{displayName} 您好</span>
          <span style={{ color: '#666', whiteSpace: 'nowrap' }}>
            目前操作個案：{operatingDispatchCaseLabel ?? '(未設定)'}
          </span>
          <span
            onClick={clearSessionAndRedirectToLogin}
            style={{ cursor: 'pointer', color: '#1677ff', whiteSpace: 'nowrap' }}
          >
            <LogoutOutlined /> 登出
          </span>
        </Space>
      </div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', minWidth: 0 }}>{actions}</div>
    </div>
  )
}
