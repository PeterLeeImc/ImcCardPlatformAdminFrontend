import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Checkbox, Collapse, Layout, Menu, Space, Spin, message } from 'antd'
import type { MenuProps } from 'antd'
import { apiClient } from '../api/client'
import type { RightDto, RoleDto, RoleRightsDto } from '../types'

interface RightGroup {
  module: string
  rights: RightDto[]
}

function groupRights(rights: RightDto[]): RightGroup[] {
  const groups = new Map<string, RightDto[]>()
  for (const right of rights) {
    const separatorIndex = right.rightName.indexOf('|')
    const module = separatorIndex === -1 ? right.rightName : right.rightName.slice(0, separatorIndex)
    const list = groups.get(module)
    if (list) {
      list.push(right)
    } else {
      groups.set(module, [right])
    }
  }
  return Array.from(groups.entries()).map(([module, groupRightsList]) => ({ module, rights: groupRightsList }))
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
                    children: (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px' }}>
                        {group.rights.map((right) => (
                          <Checkbox
                            key={right.id}
                            checked={checkedIds.has(right.id)}
                            onChange={(e) => toggleRight(right.id, e.target.checked)}
                          >
                            {rightLabel(right)}
                          </Checkbox>
                        ))}
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
