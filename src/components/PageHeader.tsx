import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Space } from 'antd'
import { LogoutOutlined } from '@ant-design/icons'
import { clearSessionAndRedirectToLogin } from '../api/client'

/**
 * 全部功能頁面共用的頁首：左邊頁面標題、中間「首頁」連結+目前使用者身分+登出、右邊該頁面
 * 專屬的操作按鈕(例如「新增客戶」)。原本只有首頁(Home.tsx)有身分/登出區塊，其他功能頁進去之後
 * 看不到自己是誰、也無法直接登出，統一抽成這個共用元件讓每個功能頁都套用，不用各自複製貼上、
 * 以後也不會漏改。三欄都用flex:1讓中間區塊視覺上盡量置中，不因為左右兩側內容寬度不同而偏移太多。
 * 身分只顯示使用者姓名(不含目前操作客戶名稱)，操作客戶是每個畫面各自的「選擇客戶」篩選器決定，
 * 跟這裡的登入身分是兩件事，放在一起容易誤會成「這個人只能操作這家客戶」。
 */
export default function PageHeader({ title, actions }: { title: ReactNode; actions?: ReactNode }) {
  const navigate = useNavigate()
  const chname = localStorage.getItem('platformChname') ?? ''

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
          <span style={{ color: '#666', whiteSpace: 'nowrap' }}>{chname} 您好</span>
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
