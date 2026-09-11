import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Layout, Modal, Space, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { apiClient } from '../api/client'
import type { ManagerListItem, ManagerPage } from '../types'
import { ENABLED_OPTIONS } from '../types'

const PAGE_SIZE = 20

function enabledLabel(enabled: string): string {
  return ENABLED_OPTIONS.find((o) => o.value === enabled)?.label ?? enabled
}

export default function ManagerList() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ManagerPage>()
  const [page, setPage] = useState(0)

  const fetchManagers = useCallback(async (targetPage: number) => {
    setLoading(true)
    try {
      const res = await apiClient.get<ManagerPage>('/admin/managers', {
        params: { page: targetPage, size: PAGE_SIZE },
      })
      setData(res.data)
    } catch (err) {
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? '載入使用者清單失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchManagers(page)
  }, [page, fetchManagers])

  const handleDelete = (record: ManagerListItem) => {
    Modal.confirm({
      title: '確定要刪除此使用者？',
      content: `帳號：${record.account}`,
      okType: 'danger',
      onOk: async () => {
        try {
          await apiClient.delete(`/admin/managers/${record.id}`)
          message.success('刪除成功')
          fetchManagers(page)
        } catch (err) {
          const axiosErr = err as { response?: { data?: string } }
          message.error(axiosErr.response?.data ?? '刪除失敗')
        }
      },
    })
  }

  const openResetPassword = (record: ManagerListItem) => {
    Modal.confirm({
      title: '確定要重設密碼？',
      content: (
        <>
          帳號：{record.account}
          <br />
          預設密碼為帳號，請使用者登入自行變更密碼。
        </>
      ),
      onOk: async () => {
        try {
          await apiClient.post(`/admin/managers/${record.id}/reset-password`)
          message.success('密碼已重設')
        } catch (err) {
          const axiosErr = err as { response?: { data?: string } }
          message.error(axiosErr.response?.data ?? '重設密碼失敗')
        }
      },
    })
  }

  const columns: ColumnsType<ManagerListItem> = [
    { title: '帳號', dataIndex: 'account', key: 'account' },
    { title: '使用者名稱', dataIndex: 'username', key: 'username' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: '角色', dataIndex: 'roleLabel', key: 'roleLabel' },
    {
      title: '業務代號',
      dataIndex: 'salesSerial',
      key: 'salesSerial',
      render: (v: string | null) => v ?? '-',
    },
    {
      title: '狀態',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: string) => (
        <Tag color={enabled === '1' ? 'green' : 'default'}>{enabledLabel(enabled)}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <a onClick={() => navigate(`/managers/${record.id}`)}>編輯</a>
          <a onClick={() => openResetPassword(record)}>重設密碼</a>
          <a onClick={() => handleDelete(record)} style={{ color: '#ff4d4f' }}>
            刪除
          </a>
        </Space>
      ),
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
        <Space>
          <a onClick={() => navigate('/')}>首頁</a>
          <span style={{ fontSize: 18, fontWeight: 600 }}>使用者維護</span>
        </Space>
        <Button type="primary" onClick={() => navigate('/managers/new')}>
          新增使用者
        </Button>
      </div>
      <div style={{ padding: 24 }}>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data?.content ?? []}
          pagination={{
            current: page + 1,
            pageSize: PAGE_SIZE,
            total: data?.totalElements ?? 0,
            showSizeChanger: false,
            onChange: (nextPage) => setPage(nextPage - 1),
          }}
        />
      </div>
    </Layout>
  )
}
