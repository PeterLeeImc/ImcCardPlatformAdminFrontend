import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Checkbox, Collapse, Layout, Menu, Space, Spin, message } from 'antd'
import type { MenuProps } from 'antd'
import { apiClient } from '../api/client'
import type { RightDto, RoleDto, RoleRightsDto } from '../types'

const BACKOFFICE_MODULE = '後台作業'
const PUNCH_MODULE = '打卡作業'

/**
 * 「角色功能」畫面照系統管理者首頁(Home.tsx)的三層分區重新分組/排序，取代原本單純依rightName
 * 開頭模組前綴("維護作業"/"設定作業"/"後台系統作業"/"打卡RWD")自動分組的做法——那樣分出來的
 * 群組跟首頁實際看到的功能分區對不起來，管理者不容易對照。這裡改成：首頁三層(藍/綠/黃)出現過的
 * 功能全部歸在"後台作業"底下、依首頁三層的順序排列；其餘維持"打卡RWD"前綴的打卡RWD員工端專屬功能
 * (打卡/請假/加班/簽核/補卡/班段行事曆/團隊班段行事曆)歸在"打卡作業"底下——這是這個畫面顯示分組用，
 * rightName字串本身(含資料庫rights表、後端各controller的權限比對字串、打卡RWD前端讀取權限選單的
 * 程式碼)大部分維持不動，只有這個畫面看到的標題/分組/順序改變；唯一例外是「通知」，管理端廣播
 * 跟打卡RWD員工端點對點通知原本共用同一個right("打卡RWD|通知")沒辦法分開設定，已經拆成兩個獨立
 * right："維護作業|通知廣播"(管理端，歸在這裡的後台作業/綠色列)跟"打卡RWD|收發通知"(打卡RWD員工端，
 * 歸在打卡作業)，見AdminNotificationController/AuthController.RIGHT_NAME_TO_KEY的說明。
 *
 * TIER_ROWS對照首頁三層的背景色(見Home.tsx的tiers)，同一個rightName如果被首頁兩個入口共用
 * (例如"派遣個案"和"員工維護"都對應"維護作業|員工維護")只會在第一次出現的位置顯示一次。
 */
const TIER_ROWS: { background: string; rightNames: string[] }[] = [
  {
    background: '#e6f4ff',
    rightNames: [
      '維護作業|客戶維護',
      '維護作業|員工維護',
      '設定作業|假別維護',
      '維護作業|客戶配假設定',
      '維護作業|員工配假設定',
      '設定作業|加班別維護',
    ],
  },
  {
    background: '#f0f9e8',
    rightNames: ['維護作業|員工班段行事曆', '維護作業|員工每日打卡', '維護作業|出勤明細報表', '維護作業|通知廣播'],
  },
  {
    background: '#fffbe6',
    rightNames: [
      '後台系統作業|使用者維護',
      '後台系統作業|角色功能',
      '設定作業|假日檔維護',
      '維護作業|多客戶班表匯入',
      '打卡RWD|操作紀錄',
      '打卡RWD|登入紀錄',
    ],
  },
]

const BACKOFFICE_ORDER = TIER_ROWS.flatMap((tier) => tier.rightNames)

interface RightGroup {
  module: string
  rights: RightDto[]
}

function groupRights(rights: RightDto[]): RightGroup[] {
  const byName = new Map(rights.map((r) => [r.rightName, r]))
  const backoffice = BACKOFFICE_ORDER.map((name) => byName.get(name)).filter((r): r is RightDto => r != null)
  const backofficeIds = new Set(backoffice.map((r) => r.id))
  const punch = rights.filter((r) => !backofficeIds.has(r.id))
  const result: RightGroup[] = []
  if (backoffice.length > 0) {
    result.push({ module: BACKOFFICE_MODULE, rights: backoffice })
  }
  if (punch.length > 0) {
    result.push({ module: PUNCH_MODULE, rights: punch })
  }
  return result
}

function rightLabel(right: RightDto): string {
  const separatorIndex = right.rightName.indexOf('|')
  return separatorIndex === -1 ? right.rightName : right.rightName.slice(separatorIndex + 1)
}

export default function RoleRightsMatrix() {
  const navigate = useNavigate()
  const [roles, setRoles] = useState<RoleDto[]>([])
  const [rights, setRights] = useState<RightDto[]>([])
  const [selectedRoleId, setSelectedRoleId] = useState<number>()
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set())
  const [loadingBase, setLoadingBase] = useState(false)
  const [loadingGrants, setLoadingGrants] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoadingBase(true)
    Promise.all([
      apiClient.get<RoleDto[]>('/admin/role-rights/roles'),
      apiClient.get<RightDto[]>('/admin/role-rights/rights'),
    ])
      .then(([rolesRes, rightsRes]) => {
        setRoles(rolesRes.data)
        setRights(rightsRes.data)
        if (rolesRes.data.length > 0) {
          setSelectedRoleId(rolesRes.data[0].id)
        }
      })
      .catch((err) => {
        const axiosErr = err as { response?: { data?: string } }
        message.error(axiosErr.response?.data ?? '載入角色/權限清單失敗')
      })
      .finally(() => setLoadingBase(false))
  }, [])

  const loadGrants = useCallback((roleId: number) => {
    setLoadingGrants(true)
    apiClient
      .get<RoleRightsDto>(`/admin/role-rights/roles/${roleId}`)
      .then((res) => setCheckedIds(new Set(res.data.rightIds)))
      .catch((err) => {
        const axiosErr = err as { response?: { data?: string } }
        message.error(axiosErr.response?.data ?? '載入角色權限失敗')
      })
      .finally(() => setLoadingGrants(false))
  }, [])

  useEffect(() => {
    if (selectedRoleId != null) {
      // 切換角色時捨棄尚未儲存的勾選狀態，改抓該角色目前實際已授權的清單
      loadGrants(selectedRoleId)
    }
  }, [selectedRoleId, loadGrants])

  const groups = useMemo(() => groupRights(rights), [rights])
  const rightsById = useMemo(() => new Map(rights.map((r) => [r.rightName, r])), [rights])

  const toggleRight = (rightId: number, checked: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(rightId)
      } else {
        next.delete(rightId)
      }
      return next
    })
  }

  const handleSave = async () => {
    if (selectedRoleId == null) return
    setSaving(true)
    try {
      const body: RoleRightsDto = { roleId: selectedRoleId, rightIds: Array.from(checkedIds) }
      await apiClient.put(`/admin/role-rights/roles/${selectedRoleId}`, body)
      message.success('儲存成功')
    } catch (err) {
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  const menuItems: MenuProps['items'] = roles.map((role) => ({ key: String(role.id), label: role.roleName }))

  const renderCheckbox = (right: RightDto) => (
    <Checkbox
      key={right.id}
      checked={checkedIds.has(right.id)}
      onChange={(e) => toggleRight(right.id, e.target.checked)}
    >
      {rightLabel(right)}
    </Checkbox>
  )

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
        <Space>
          <a onClick={() => navigate('/')}>首頁</a>
          <span style={{ fontSize: 18, fontWeight: 600 }}>角色功能</span>
        </Space>
        <Button type="primary" onClick={handleSave} loading={saving} disabled={selectedRoleId == null}>
          儲存
        </Button>
      </div>
      <Spin spinning={loadingBase}>
        <div style={{ display: 'flex', padding: 24, gap: 24 }}>
          <div style={{ width: 220, background: '#fff', borderRadius: 8 }}>
            <Menu
              mode="vertical"
              selectedKeys={selectedRoleId != null ? [String(selectedRoleId)] : []}
              items={menuItems}
              onClick={({ key }) => setSelectedRoleId(Number(key))}
            />
          </div>
          <div style={{ flex: 1, background: '#fff', borderRadius: 8, padding: 16 }}>
            <Spin spinning={loadingGrants}>
              {groups.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>尚無權限項目</div>
              ) : (
                <Collapse
                  defaultActiveKey={groups.map((g) => g.module)}
                  items={groups.map((group) => ({
                    key: group.module,
                    label: group.module,
                    children:
                      group.module === BACKOFFICE_MODULE ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {TIER_ROWS.map((tier, tierIndex) => {
                            const tierRights = tier.rightNames
                              .map((name) => rightsById.get(name))
                              .filter((r): r is RightDto => r != null)
                            if (tierRights.length === 0) {
                              return null
                            }
                            return (
                              <div
                                key={tierIndex}
                                style={{
                                  background: tier.background,
                                  borderRadius: 8,
                                  padding: 12,
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: '8px 24px',
                                }}
                              >
                                {tierRights.map(renderCheckbox)}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px' }}>
                          {group.rights.map(renderCheckbox)}
                        </div>
                      ),
                  }))}
                />
              )}
            </Spin>
          </div>
        </div>
      </Spin>
    </Layout>
  )
}
