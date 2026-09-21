import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Input, Layout, Modal, Spin, message } from 'antd'
import { apiClient, clearSessionAndRedirectToLogin, isSystemAdminRole } from '../api/client'
import PageHeader from '../components/PageHeader'
import {
  TeamOutlined,
  SafetyCertificateOutlined,
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
  ScheduleOutlined,
  DatabaseOutlined,
  TableOutlined,
  SyncOutlined,
  CoffeeOutlined,
  HourglassOutlined,
  SwapOutlined,
} from '@ant-design/icons'

const RESET_CONFIRM_TEXT = 'RESET'

export default function Home() {
  const navigate = useNavigate()

  const [permissions, setPermissions] = useState<Set<string>>()
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    apiClient.get<string[]>('/auth/admin-permissions').then((res) => {
      setPermissions(new Set(res.data))
    })
  }, [])

  const openResetDatabase = () => {
    setResetConfirmText('')
    setResetModalOpen(true)
  }

  const confirmResetDatabase = async () => {
    setResetting(true)
    try {
      const res = await apiClient.post<{ templatePreserved: boolean; templateCompanyName: string | null }>(
        '/admin/reset-database',
      )
      message.success(
        res.data.templatePreserved
          ? `資料庫已還原成初始狀態(保留樣板客戶「${res.data.templateCompanyName}」)，即將登出，請重新登入`
          : '資料庫已還原成初始狀態，即將登出，請重新登入',
      )
      setResetModalOpen(false)
      clearSessionAndRedirectToLogin()
    } catch (err) {
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? '還原失敗')
    } finally {
      setResetting(false)
    }
  }

  const allTiers = [
    {
      background: '#e6f4ff',
      items: [
        {
          key: '/companies',
          rightName: '維護作業|客戶維護',
          label: '客戶維護',
          desc: '客戶基本資料/GPS打卡設定',
          icon: <BankOutlined style={{ fontSize: 32 }} />,
        },
        {
          key: '/dispatch-cases',
          rightName: '維護作業|員工維護',
          label: '個案維護',
          desc: '客戶底下的派遣個案清單、負責使用者、班表內容(同客戶不同個案可各自設定班表)',
          icon: <ApartmentOutlined style={{ fontSize: 32 }} />,
        },
        {
          key: '/time-schedules',
          rightName: '維護作業|員工維護',
          label: '班表維護',
          desc: '派遣個案的班別時段/打卡地點設定',
          icon: <TableOutlined style={{ fontSize: 32 }} />,
        },
        {
          key: '/employees',
          rightName: '維護作業|員工維護',
          label: '員工維護',
          desc: '員工主檔資料/派遣個案異動',
          icon: <IdcardOutlined style={{ fontSize: 32 }} />,
        },
        {
          key: '/leave-types',
          rightName: '設定作業|假別維護',
          label: '假別維護',
          desc: '客戶假別主檔(年假/補休/事假等)',
          icon: <TagsOutlined style={{ fontSize: 32 }} />,
        },
        {
          key: '/company-leave-types',
          rightName: '維護作業|客戶配假設定',
          label: '客戶配假設定',
          desc: '各客戶每年度的假別規則',
          icon: <CalendarOutlined style={{ fontSize: 32 }} />,
        },
        {
          key: '/employee-leave-types',
          rightName: '維護作業|員工配假設定',
          label: '員工配假設定',
          desc: '個別員工的假別額度',
          icon: <UserSwitchOutlined style={{ fontSize: 32 }} />,
        },
        {
          key: '/work-overtimes',
          rightName: '設定作業|加班別維護',
          label: '加班別維護',
          desc: '客戶加班別主檔',
          icon: <FieldTimeOutlined style={{ fontSize: 32 }} />,
        },
      ],
    },
    {
      background: '#f0f9e8',
      items: [
        {
          key: '/emp-schedule-calendar',
          rightName: '維護作業|員工維護',
          label: '員工班段行事曆',
          desc: '派遣個案內任一員工的排班行事曆、調班、快速排班、Excel匯入',
          icon: <AppstoreOutlined style={{ fontSize: 32 }} />,
        },
        {
          key: '/emp-day-cards',
          rightName: '維護作業|員工每日打卡',
          label: '員工每日打卡',
          desc: '查看員工打卡明細與照片',
          icon: <ClockCircleOutlined style={{ fontSize: 32 }} />,
        },
        {
          key: '/emp-day-leaves',
          rightName: '維護作業|員工每日請假',
          label: '員工每日請假',
          desc: '查看員工請假單與簽核狀況',
          icon: <CoffeeOutlined style={{ fontSize: 32 }} />,
        },
        {
          key: '/emp-day-overtimes',
          rightName: '維護作業|員工每日加班',
          label: '員工每日加班',
          desc: '查看員工加班單與簽核狀況',
          icon: <HourglassOutlined style={{ fontSize: 32 }} />,
        },
        {
          key: '/approval-delegates',
          rightName: '維護作業|簽核代理人維護',
          label: '簽核代理人維護',
          desc: '幫員工設定/取消簽核代理人',
          icon: <SwapOutlined style={{ fontSize: 32 }} />,
        },
        {
          key: '/attendance-detail-report',
          rightName: '維護作業|出勤明細報表',
          label: '出勤明細報表',
          desc: '排班/打卡/請假/加班彙總報表',
          icon: <FileTextOutlined style={{ fontSize: 32 }} />,
        },
        {
          key: '/notifications',
          rightName: '維護作業|通知廣播',
          label: '通知廣播',
          desc: '發送全客戶廣播通知',
          icon: <NotificationOutlined style={{ fontSize: 32 }} />,
        },
      ],
    },
    {
      background: '#fffbe6',
      items: [
        {
          key: '/managers',
          rightName: '後台系統作業|使用者維護',
          label: '使用者維護',
          desc: '後台管理者帳號的新增/編輯/刪除/重設密碼',
          icon: <TeamOutlined style={{ fontSize: 32 }} />,
        },
        {
          key: '/role-rights',
          rightName: '後台系統作業|角色功能',
          label: '角色功能',
          desc: '設定各角色可使用的功能權限',
          icon: <SafetyCertificateOutlined style={{ fontSize: 32 }} />,
        },
        {
          key: '/holidays',
          rightName: '設定作業|假日檔維護',
          label: '假日檔維護',
          desc: '國定假日/客戶行事曆主檔，可Excel批次匯出匯入',
          icon: <ScheduleOutlined style={{ fontSize: 32 }} />,
        },
        {
          key: '/scheduled-jobs',
          rightName: '後台系統作業|排程管理',
          label: '排程管理',
          desc: '查看目前系統排程與說明，可設定執行時間、手動執行',
          icon: <SyncOutlined style={{ fontSize: 32 }} />,
        },
        {
          key: '/operation-logs',
          rightName: '打卡RWD|操作紀錄',
          label: '操作記錄',
          desc: '查詢打卡RWD所有使用者的操作紀錄',
          icon: <HistoryOutlined style={{ fontSize: 32 }} />,
        },
        {
          key: '/login-logs',
          rightName: '打卡RWD|登入紀錄',
          label: '登入紀錄',
          desc: '查詢打卡RWD所有使用者的登入紀錄',
          icon: <LoginOutlined style={{ fontSize: 32 }} />,
        },
      ],
    },
  ]

  // 沒權限的功能直接不顯示(不是顯示但disabled)，理由跟RWD員工端Home.tsx一致：管理端首頁
  // 也是給多種角色共用的同一份選單，角色沒被授權的功能對這個人來說根本不存在，不需要看到。
  const tiers = allTiers
    .map((tier) => ({
      ...tier,
      items: tier.items.filter((item) => permissions?.has(item.rightName)),
    }))
    .filter((tier) => tier.items.length > 0)

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f6f8' }}>
      <PageHeader title="IMC打卡平台管理端" />
      <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {!permissions ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : tiers.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', padding: 40, fontSize: 14 }}>
            您的角色尚未被開通任何功能，請聯繫系統管理者到「角色功能」開通
          </div>
        ) : (
          tiers.map((tier, tierIndex) => (
          <div
            key={tierIndex}
            style={{
              background: tier.background,
              borderRadius: 12,
              padding: 24,
              display: 'flex',
              gap: 24,
              flexWrap: 'wrap',
            }}
          >
            {tier.items.some((i) => i.key === '/managers') && isSystemAdminRole() && (
              <Card hoverable onClick={openResetDatabase} style={{ width: 260, borderColor: '#ff4d4f' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ color: '#ff4d4f' }}>
                    <DatabaseOutlined style={{ fontSize: 32 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#ff4d4f' }}>預設資料庫</div>
                    <div style={{ fontSize: 13, color: '#999' }}>清空測試資料，還原成初始狀態</div>
                  </div>
                </div>
              </Card>
            )}
            {tier.items.map((item) => (
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
          ))
        )}
      </div>
      <Modal
        title="還原資料庫為初始狀態"
        open={resetModalOpen}
        onCancel={() => setResetModalOpen(false)}
        onOk={confirmResetDatabase}
        confirmLoading={resetting}
        okButtonProps={{ danger: true, disabled: resetConfirmText !== RESET_CONFIRM_TEXT }}
        okText="確定還原"
        destroyOnHidden
      >
        <p>
          這個操作會<b>清空所有客戶、員工、派遣個案、假別、配假、加班別、排班、打卡、請假、加班、通知、
          操作紀錄、登入紀錄</b>等資料，只保留 imcPeter 這一個使用者帳號，角色權限設定不受影響。
        </p>
        <p>如果有設定樣板客戶，這家公司連同底下的個案/員工/假別/加班別/排班等資料會一併保留，不會被清空。</p>
        <p style={{ color: '#ff4d4f' }}>此操作無法復原，執行後會立即登出，請確認是本機測試環境再繼續。</p>
        <p>
          請輸入 <b>{RESET_CONFIRM_TEXT}</b> 以確認：
        </p>
        <Input
          value={resetConfirmText}
          onChange={(e) => setResetConfirmText(e.target.value)}
          placeholder={RESET_CONFIRM_TEXT}
          onPressEnter={() => {
            if (resetConfirmText === RESET_CONFIRM_TEXT) confirmResetDatabase()
          }}
        />
      </Modal>
    </Layout>
  )
}
