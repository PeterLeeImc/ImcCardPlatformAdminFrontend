import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Layout, Modal, Space, Table, Tag, message } from 'antd'
import { DeleteOutlined, EditOutlined, KeyOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { apiClient } from '../api/client'
import type { ManagerListItem, ManagerPage } from '../types'
import { ENABLED_OPTIONS } from '../types'
import { compareStrings } from '../utils/tableSort'
import PageHeader from '../components/PageHeader'
import ActionIcon from '../components/ActionIcon'
import ResultCount from '../components/ResultCount'
import PageSizeSelect from '../components/PageSizeSelect'

function enabledLabel(enabled: string): string {
  return ENABLED_OPTIONS.find((o) => o.value === enabled)?.label ?? enabled
}

export default function ManagerList() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ManagerPage>()
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  const fetchManagers = useCallback(async (targetPage: number, size: number) => {
    setLoading(true)
    try {
      const res = await apiClient.get<ManagerPage>('/admin/managers', {
        params: { page: targetPage, size },
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
    fetchManagers(page, pageSize)
  }, [page, pageSize, fetchManagers])

  const handleDelete = (record: ManagerListItem) => {
    Modal.confirm({
      title: '確定要刪除此使用者？',
      content: `帳號：${record.account}`,
      okType: 'danger',
      onOk: async () => {
        try {
          await apiClient.delete(`/admin/managers/${record.id}`)
          message.success('刪除成功')
          fetchManagers(page, pageSize)
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
    {
      title: '序號',
      key: 'seq',
      width: 60,
      render: (_, __, index) => page * pageSize + index + 1,
    },
    { title: '帳號', dataIndex: 'account', key: 'account', sorter: (a, b) => compareStrings(a.account, b.account) },
    {
      title: '使用者名稱',
      dataIndex: 'username',
      key: 'username',
      sorter: (a, b) => compareStrings(a.username, b.username),
    },
    { title: 'Email', dataIndex: 'email', key: 'email', sorter: (a, b) => compareStrings(a.email, b.email) },
    {
      title: '角色',
      dataIndex: 'roleLabel',
      key: 'roleLabel',
      sorter: (a, b) => compareStrings(a.roleLabel, b.roleLabel),
    },
    {
      title: '業務代號',
      dataIndex: 'salesSerial',
      key: 'salesSerial',
      render: (v: string | null) => v ?? '-',
      sorter: (a, b) => compareStrings(a.salesSerial, b.salesSerial),
    },
    {
      title: '狀態',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: string) => (
        <Tag color={enabled === '1' ? 'green' : 'default'}>{enabledLabel(enabled)}</Tag>
      ),
      sorter: (a, b) => compareStrings(enabledLabel(a.enabled), enabledLabel(b.enabled)),
    },
    {
      title: '備註',
      dataIndex: 'descr',
      key: 'descr',
      ellipsis: true,
      render: (v: string | null) => v ?? '-',
      sorter: (a, b) => compareStrings(a.descr, b.descr),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <ActionIcon title="編輯" icon={<EditOutlined />} onClick={() => navigate(`/managers/${record.id}`)} />
          <ActionIcon title="重設密碼" icon={<KeyOutlined />} onClick={() => openResetPassword(record)} />
          <ActionIcon title="刪除" icon={<DeleteOutlined />} danger onClick={() => handleDelete(record)} />
        </Space>
      ),
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f6f8' }}>
      <PageHeader
        title="使用者維護"
        actions={
          <Button type="primary" onClick={() => navigate('/managers/new')}>
            新增使用者
          </Button>
        }
      />
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <Space>
            <ResultCount count={data?.totalElements} />
            <PageSizeSelect
              value={pageSize}
              onChange={(v) => {
                setPageSize(v)
                setPage(0)
              }}
            />
          </Space>
        </div>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data?.content ?? []}
          pagination={{
            current: page + 1,
            pageSize,
            total: data?.totalElements ?? 0,
            showSizeChanger: false,
            onChange: (nextPage) => setPage(nextPage - 1),
          }}
        />
      </div>
    </Layout>
  )
}
