import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Layout, Modal, Space, Table, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { apiClient } from '../api/client'
import type { CompanyListItem, LogPage } from '../types'

const PAGE_SIZE = 20

export default function CompanyList() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<LogPage<CompanyListItem>>()
  const [page, setPage] = useState(0)

  const fetchCompanies = useCallback(async (targetPage: number) => {
    setLoading(true)
    try {
      const res = await apiClient.get<LogPage<CompanyListItem>>('/admin/companies', {
        params: { page: targetPage, size: PAGE_SIZE },
      })
      setData(res.data)
    } catch (err) {
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? '載入公司清單失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCompanies(page)
  }, [page, fetchCompanies])

  const handleDelete = (record: CompanyListItem) => {
    Modal.confirm({
      title: '確定要刪除這家公司？',
      content: `公司代碼：${record.companyNum}`,
      okType: 'danger',
      onOk: async () => {
        try {
          await apiClient.delete(`/admin/companies/${record.id}`)
          message.success('刪除成功')
          fetchCompanies(page)
        } catch (err) {
          const axiosErr = err as { response?: { data?: string } }
          message.error(axiosErr.response?.data ?? '刪除失敗')
        }
      },
    })
  }

  const columns: ColumnsType<CompanyListItem> = [
    { title: '公司代碼', dataIndex: 'companyNum', key: 'companyNum' },
    { title: '公司名稱', dataIndex: 'chName', key: 'chName' },
    { title: '簡稱', dataIndex: 'name4Short', key: 'name4Short' },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <a onClick={() => navigate(`/dispatch-cases?companyId=${record.id}`)}>派遣個案/班表</a>
          <a onClick={() => navigate(`/companies/${record.id}`)}>編輯</a>
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
          <span style={{ fontSize: 18, fontWeight: 600 }}>公司維護</span>
        </Space>
        <Button type="primary" onClick={() => navigate('/companies/new')}>
          新增公司
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
