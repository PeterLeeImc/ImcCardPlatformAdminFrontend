import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Form, Input, InputNumber, Layout, Modal, Select, Space, Table, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { apiClient } from '../api/client'
import {
  LEAVE_DEFAULT_FILED_OPTIONS,
  LEAVE_SEX_CONDITION_OPTIONS,
  type CompanyListItem,
  type LeaveTypeMasterItem,
  type LeaveTypeMasterUpsertRequest,
  type LogPage,
} from '../types'
import { formatDateTime } from '../utils/formatDateTime'

export default function LeaveTypeList() {
  const navigate = useNavigate()
  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [companyId, setCompanyId] = useState<number>()
  const [rows, setRows] = useState<LeaveTypeMasterItem[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<LeaveTypeMasterItem | 'new'>()
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<LeaveTypeMasterUpsertRequest>()

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
      .get<LeaveTypeMasterItem[]>('/admin/leave-types', { params: { companyId } })
      .then((res) => setRows(res.data))
      .catch((err) => {
        const axiosErr = err as { response?: { data?: string } }
        message.error(axiosErr.response?.data ?? '載入假別清單失敗')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  const openEdit = (row: LeaveTypeMasterItem | 'new') => {
    setEditing(row)
    if (row === 'new') {
      form.resetFields()
    } else {
      form.setFieldsValue({
        chname: row.chname,
        enname: row.enname ?? undefined,
        leaveDefaultFiled: row.leaveDefaultFiled ?? undefined,
        leaveSexCondition: row.leaveSexCondition ?? undefined,
        attachFileHours: row.attachFileHours ?? undefined,
      })
    }
  }

  const submitEdit = async () => {
    if (!editing || !companyId) return
    try {
      const values = await form.validateFields()
      setSaving(true)
      if (editing === 'new') {
        await apiClient.post('/admin/leave-types', values, { params: { companyId } })
        message.success('已新增假別')
      } else {
        await apiClient.put(`/admin/leave-types/${editing.id}`, values)
        message.success('已更新假別')
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

  const handleDelete = (row: LeaveTypeMasterItem) => {
    Modal.confirm({
      title: '確定要刪除這個假別？',
      content: `假別：${row.chname}`,
      okType: 'danger',
      onOk: async () => {
        try {
          await apiClient.delete(`/admin/leave-types/${row.id}`)
          message.success('刪除成功')
          fetchRows()
        } catch (err) {
          const axiosErr = err as { response?: { data?: string } }
          message.error(axiosErr.response?.data ?? '刪除失敗')
        }
      },
    })
  }

  const labelOf = (options: { value: string; label: string }[], value: string | null) =>
    options.find((o) => o.value === value)?.label ?? '-'

  const columns: ColumnsType<LeaveTypeMasterItem> = [
    { title: '中文名稱', dataIndex: 'chname', key: 'chname' },
    { title: '英文名稱', dataIndex: 'enname', key: 'enname' },
    {
      title: '角色代碼',
      dataIndex: 'leaveDefaultFiled',
      key: 'leaveDefaultFiled',
      render: (v) => labelOf(LEAVE_DEFAULT_FILED_OPTIONS, v),
    },
    {
      title: '性別條件',
      dataIndex: 'leaveSexCondition',
      key: 'leaveSexCondition',
      render: (v) => labelOf(LEAVE_SEX_CONDITION_OPTIONS, v),
    },
    { title: '需附件最小時數', dataIndex: 'attachFileHours', key: 'attachFileHours' },
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
          <span style={{ fontSize: 18, fontWeight: 600 }}>假別維護</span>
        </Space>
        <Button type="primary" onClick={() => openEdit('new')} disabled={!companyId}>
          新增假別
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
        title={editing === 'new' ? '新增假別' : '編輯假別'}
        open={!!editing}
        onCancel={() => setEditing(undefined)}
        onOk={submitEdit}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="chname" label="中文名稱" rules={[{ required: true, message: '請輸入中文名稱' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="enname" label="英文名稱">
            <Input />
          </Form.Item>
          <Form.Item name="leaveDefaultFiled" label="角色代碼" extra="用來讓系統識別這筆假別在流程中的特殊角色，例如客戶配假設定的批次動作要靠這個代碼找到「年假」「補休」對應的假別，不是用名稱比對">
            <Select allowClear options={LEAVE_DEFAULT_FILED_OPTIONS} />
          </Form.Item>
          <Form.Item name="leaveSexCondition" label="性別條件">
            <Select allowClear options={LEAVE_SEX_CONDITION_OPTIONS} />
          </Form.Item>
          <Form.Item name="attachFileHours" label="需附件最小時數" extra="請假時數達到這個門檻才需要上傳附件，留空代表不需要附件">
            <InputNumber style={{ width: '100%' }} min={0} />
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
