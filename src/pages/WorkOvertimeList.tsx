import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Form, Input, Layout, Modal, Select, Space, Table, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { apiClient } from '../api/client'
import type { CompanyListItem, LogPage, WorkOvertimeItem, WorkOvertimeUpsertRequest } from '../types'
import { formatDateTime } from '../utils/formatDateTime'

export default function WorkOvertimeList() {
  const navigate = useNavigate()
  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [companyId, setCompanyId] = useState<number>()
  const [rows, setRows] = useState<WorkOvertimeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<WorkOvertimeItem | 'new'>()
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<WorkOvertimeUpsertRequest>()

  useEffect(() => {
    apiClient
      .get<LogPage<CompanyListItem>>('/admin/companies', { params: { page: 0, size: 200 } })
      .then((res) => {
        setCompanies(res.data.content)
        if (res.data.content.length > 0) {
          setCompanyId(res.data.content[0].id)
        }
      })
      .catch(() => message.error('載入客戶清單失敗'))
  }, [])

  const fetchRows = () => {
    if (!companyId) return
    setLoading(true)
    apiClient
      .get<WorkOvertimeItem[]>('/admin/work-overtimes', { params: { companyId } })
      .then((res) => setRows(res.data))
      .catch((err) => {
        const axiosErr = err as { response?: { data?: string } }
        message.error(axiosErr.response?.data ?? '載入加班別清單失敗')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  const openEdit = (row: WorkOvertimeItem | 'new') => {
    setEditing(row)
    if (row === 'new') {
      form.resetFields()
    } else {
      form.setFieldsValue({ chName: row.chName })
    }
  }

  const submitEdit = async () => {
    if (!editing || !companyId) return
    try {
      const values = await form.validateFields()
      setSaving(true)
      if (editing === 'new') {
        await apiClient.post('/admin/work-overtimes', values, { params: { companyId } })
        message.success('已新增加班別')
      } else {
        await apiClient.put(`/admin/work-overtimes/${editing.id}`, values)
        message.success('已更新加班別')
      }
      setEditing(undefined)
      fetchRows()
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (row: WorkOvertimeItem) => {
    Modal.confirm({
      title: '確定要刪除這個加班別？',
      content: `加班別：${row.chName}`,
      okType: 'danger',
      onOk: async () => {
        try {
          await apiClient.delete(`/admin/work-overtimes/${row.id}`)
          message.success('刪除成功')
          fetchRows()
        } catch (err) {
          const axiosErr = err as { response?: { data?: string } }
          message.error(axiosErr.response?.data ?? '刪除失敗')
        }
      },
    })
  }

  const columns: ColumnsType<WorkOvertimeItem> = [
    { title: '加班別名稱', dataIndex: 'chName', key: 'chName' },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <a onClick={() => openEdit(record)}>編輯</a>
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
          <span style={{ fontSize: 18, fontWeight: 600 }}>加班別維護</span>
        </Space>
        <Button type="primary" onClick={() => openEdit('new')} disabled={!companyId}>
          新增加班別
        </Button>
      </div>
      <div style={{ padding: 24 }}>
        <Space style={{ marginBottom: 16 }}>
          <span>選擇客戶：</span>
          <Select
            style={{ width: 240 }}
            placeholder="選擇客戶"
            value={companyId}
            onChange={setCompanyId}
            options={companies.map((c) => ({ value: c.id, label: `${c.companyNum} ${c.chName}` }))}
          />
        </Space>
        <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={false} />
      </div>
      <Modal
        title={editing === 'new' ? '新增加班別' : '編輯加班別'}
        open={!!editing}
        onCancel={() => setEditing(undefined)}
        onOk={submitEdit}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="chName" label="加班別名稱" rules={[{ required: true, message: '請輸入加班別名稱' }]}>
            <Input placeholder="例如：平日加班、假日加班" />
          </Form.Item>
        </Form>
        {editing && editing !== 'new' && (
          <div style={{ fontSize: 12, color: '#999' }}>
            建立時間：{formatDateTime(editing.createdAt)}　建立者：{editing.createdBy ?? '-'}　異動時間：
            {formatDateTime(editing.updatedAt)}　異動者：{editing.updatedBy ?? '-'}
          </div>
        )}
      </Modal>
    </Layout>
  )
}
