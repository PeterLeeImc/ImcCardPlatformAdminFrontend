import { useNavigate } from 'react-router-dom'
import { Card, Layout, Space } from 'antd'
import {
  TeamOutlined,
  SafetyCertificateOutlined,
  LogoutOutlined,
  HistoryOutlined,
  LoginOutlined,
  NotificationOutlined,
  BankOutlined,
  CalendarOutlined,
  UserSwitchOutlined,
  ApartmentOutlined,
  IdcardOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  TagsOutlined,
  FieldTimeOutlined,
  AppstoreOutlined,
  ImportOutlined,
  ScheduleOutlined,
} from '@ant-design/icons'
import { clearSessionAndRedirectToLogin } from '../api/client'

export default function Home() {
  const navigate = useNavigate()
  const chname = localStorage.getItem('platformChname') ?? ''
  const companyName = localStorage.getItem('platformOperatingCompanyName')
  const displayName = companyName ? `${companyName} - ${chname}` : chname

  const logout = () => {
    clearSessionAndRedirectToLogin()
  }

  const menuItems = [
    {
      key: '/batch-import',
      label: '多公司班表匯入',
      desc: '一次匯出/匯入全部公司的公司資料、班表、假別、加班別',
      icon: <ImportOutlined style={{ fontSize: 32 }} />,
    },
    {
      key: '/companies',
      label: '公司維護',
      desc: '公司基本資料/GPS打卡設定',
      icon: <BankOutlined style={{ fontSize: 32 }} />,
    },
    {
      key: '/employees',
      label: '員工維護',
      desc: '員工主檔資料/部門異動',
      icon: <IdcardOutlined style={{ fontSize: 32 }} />,
    },
    {
      key: '/dispatch-cases',
      label: '派遣個案',
      desc: '公司底下的派遣個案清單、負責使用者、班表內容(同公司不同個案可各自設定班表)',
      icon: <ApartmentOutlined style={{ fontSize: 32 }} />,
    },
    {
      key: '/leave-types',
      label: '假別維護',
      desc: '公司假別主檔(年假/補休/事假等)',
      icon: <TagsOutlined style={{ fontSize: 32 }} />,
    },
    {
      key: '/work-overtimes',
      label: '加班別維護',
      desc: '公司加班別主檔',
      icon: <FieldTimeOutlined style={{ fontSize: 32 }} />,
    },
    {
      key: '/holidays',
      label: '假日檔維護',
      desc: '國定假日/公司行事曆主檔，可Excel批次匯出匯入',
      icon: <ScheduleOutlined style={{ fontSize: 32 }} />,
    },
    {
      key: '/emp-schedule-calendar',
      label: '員工班段行事曆',
      desc: '派遣個案內任一員工的排班行事曆、調班、快速排班、Excel匯入',
      icon: <AppstoreOutlined style={{ fontSize: 32 }} />,
    },
    {
      key: '/emp-day-cards',
      label: '員工每日打卡',
      desc: '查看員工打卡明細與照片',
      icon: <ClockCircleOutlined style={{ fontSize: 32 }} />,
    },
    {
      key: '/attendance-detail-report',
      label: '出勤明細報表',
      desc: '排班/打卡/請假/加班彙總報表',
      icon: <FileTextOutlined style={{ fontSize: 32 }} />,
    },
    {
      key: '/company-leave-types',
      label: '公司配假維護',
      desc: '各公司每年度的假別規則',
      icon: <CalendarOutlined style={{ fontSize: 32 }} />,
    },
    {
      key: '/employee-leave-types',
      label: '員工配假維護',
      desc: '個別員工的假別額度',
      icon: <UserSwitchOutlined style={{ fontSize: 32 }} />,
    },
    {
      key: '/managers',
      label: '使用者維護',
      desc: '後台管理者帳號的新增/編輯/刪除/重設密碼',
      icon: <TeamOutlined style={{ fontSize: 32 }} />,
    },
    {
      key: '/role-rights',
      label: '角色功能',
      desc: '設定各角色可使用的功能權限',
      icon: <SafetyCertificateOutlined style={{ fontSize: 32 }} />,
    },
    {
      key: '/notifications',
      label: '通知',
      desc: '發送全公司廣播通知',
      icon: <NotificationOutlined style={{ fontSize: 32 }} />,
    },
    {
      key: '/operation-logs',
      label: '操作記錄',
      desc: '查詢打卡RWD所有使用者的操作紀錄',
      icon: <HistoryOutlined style={{ fontSize: 32 }} />,
    },
    {
      key: '/login-logs',
      label: '登入紀錄',
      desc: '查詢打卡RWD所有使用者的登入紀錄',
      icon: <LoginOutlined style={{ fontSize: 32 }} />,
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f6f8' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          background: '#fff',
          borderBottom: '1px solid #eee',
        }}
      >
        <span style={{ fontSize: 18, fontWeight: 600 }}>IMC後台管理</span>
        <Space size={16}>
          <span style={{ color: '#666' }}>{displayName} 您好</span>
          <span onClick={logout} style={{ cursor: 'pointer', color: '#1677ff' }}>
            <LogoutOutlined /> 登出
          </span>
        </Space>
      </div>
      <div style={{ padding: 32, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {menuItems.map((item) => (
          <Card
            key={item.key}
            hoverable
            onClick={() => navigate(item.key)}
            style={{ width: 260 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ color: '#1677ff' }}>{item.icon}</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontSize: 13, color: '#999' }}>{item.desc}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Layout>
  )
}
