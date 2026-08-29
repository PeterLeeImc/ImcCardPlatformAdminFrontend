import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Form, Input, Layout, Modal, Select, Space, Table, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { apiClient } from '../api/client'
import type { ComTimeScheduleItem, ComTimeScheduleUpsertRequest, CompanyListItem, LogPage } from '../types'

export default function ComTimeScheduleList() {
  const navigate = useNavigate()
  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [companyId, setCompanyId] = useState<number>()
  const [rows, setRows] = useState<ComTimeScheduleItem[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<ComTimeScheduleItem | 'new'>()
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<ComTimeScheduleUpsertRequest>()

  useEffect(() => {
    apiClient
      .get<LogPage<CompanyListItem>>('/admin/companies', { params: { page: 0, size: 200 } })
      .then((res) => {
        setCompanies(res.data.content)
        if (res.data.content.length > 0) {
          setCompanyId(res.data.content[0].id)
        }
      })
      .catch(() => message.error('載入公司清單失敗'))
  }, [])

  const fetchRows = () => {
    if (!companyId) return
    setLoading(true)
    apiClient
      .get<ComTimeScheduleItem[]>(`/admin/companies/${companyId}/time-schedules`)
      .then((res) => setRows(res.data))
      .catch((err) => {
        const axiosErr = err as { response?: { data?: string } }
        message.error(axiosErr.response?.data ?? '載入班表清單失敗')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  const openEdit = (row: ComTimeScheduleItem | 'new') => {
    setEditing(row)
    if (row === 'new') {
      form.resetFields()
    } else {
      form.setFieldsValue({
        workType: row.workType,
        onTime: row.onTime ?? undefined,
        offTime: row.offTime ?? undefined,
        noonBreakStartTime: row.noonBreakStartTime ?? undefined,
        noonBreakEndTime: row.noonBreakEndTime ?? undefined,
      })
    }
  }

  const submitEdit = async () => {
    if (!editing || !companyId) return
    try {
      const values = await form.validateFields()
      setSaving(true)
      if (editing === 'new') {
        await apiClient.post(`/admin/companies/${companyId}/time-schedules`, values)
        message.success('已新增班表')
      } else {
        await apiClient.put(`/admin/companies/${companyId}/time-schedules/${editing.id}`, values)
        message.success('已更新班表')
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

  const handleDelete = (row: ComTimeScheduleItem) => {
    if (!companyId) return
    Modal.confirm({
      title: '確定要刪除這個班表？',
      content: `班別代碼：${row.workType}`,
      okType: 'danger',
      onOk: async () => {
        try {
          await apiClient.delete(`/admin/companies/${companyId}/time-schedules/${row.id}`)
          message.success('刪除成功')
          fetchRows()
        } catch (err) {
          const axiosErr = err as { response?: { data?: string } }
          message.error(axiosErr.response?.data ?? '刪除失敗')
        }
      },
    })
  }

  const columns: ColumnsType<ComTimeScheduleItem> = [
    { title: '班別代碼', dataIndex: 'workType', key: 'workType' },
    { title: '上班時間', dataIndex: 'onTime', key: 'onTime' },
    { title: '下班時間', dataIndex: 'offTime', key: 'offTime' },
    { title: '午休開始', dataIndex: 'noonBreakStartTime', key: 'noonBreakStartTime' },
    { title: '午休結束', dataIndex: 'noonBreakEndTime', key: 'noonBreakEndTime' },
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
          <span style={{ fontSize: 18, fontWeight: 600 }}>班表內容</span>
        </Space>
        <Button type="primary" onClick={() => openEdit('new')} disabled={!companyId}>
          新增班表
        </Button>
      </div>
      <div style={{ padding: 24 }}>
        <Space style={{ marginBottom: 16 }}>
          <Select
            style={{ width: 240 }}
            placeholder="選擇公司"
            value={companyId}
            onChange={setCompanyId}
            options={companies.map((c) => ({ value: c.id, label: `${c.companyNum} ${c.chName}` }))}
          />
        </Space>
        <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={false} />
      </div>
      <Modal
        title={editing === 'new' ? '新增班表' : '編輯班表'}
        open={!!editing}
        onCancel={() => setEditing(undefined)}
        onOk={submitEdit}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="workType" label="班別代碼" rules={[{ required: true, message: '請輸入班別代碼' }]}>
            <Input placeholder="例如：A1" />
          </Form.Item>
          <Form.Item name="onTime" label="上班時間">
            <Input placeholder="例如：09:00" />
          </Form.Item>
          <Form.Item name="offTime" label="下班時間">
            <Input placeholder="例如：18:00" />
          </Form.Item>
          <Form.Item name="noonBreakStartTime" label="午休開始">
            <Input placeholder="例如：12:00" />
          </Form.Item>
          <Form.Item name="noonBreakEndTime" label="午休結束">
            <Input placeholder="例如：13:00" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  )
}
