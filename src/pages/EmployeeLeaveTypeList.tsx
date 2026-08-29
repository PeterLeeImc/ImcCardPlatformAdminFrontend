import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, InputNumber, Layout, Modal, Select, Space, Table, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { apiClient } from '../api/client'
import type {
  CompanyListItem,
  LogPage,
  WebEmpLeaveTypeItem,
  WebEmpLeaveTypeUpdateRequest,
  WebLeaveTypeItem,
} from '../types'

const CURRENT_YEAR = String(new Date().getFullYear())
const PAGE_SIZE = 20

export default function EmployeeLeaveTypeList() {
  const navigate = useNavigate()
  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [companyId, setCompanyId] = useState<number>()
  const [year, setYear] = useState(CURRENT_YEAR)
  const [leaveTypeId, setLeaveTypeId] = useState<number>()
  const [leaveTypeOptions, setLeaveTypeOptions] = useState<WebLeaveTypeItem[]>([])
  const [data, setData] = useState<LogPage<WebEmpLeaveTypeItem>>()
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<WebEmpLeaveTypeItem>()
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<WebEmpLeaveTypeUpdateRequest>()

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

  useEffect(() => {
    if (!companyId || !year) return
    apiClient
      .get<WebLeaveTypeItem[]>('/admin/company-leave-types', { params: { companyId, year } })
      .then((res) => setLeaveTypeOptions(res.data))
      .catch(() => setLeaveTypeOptions([]))
  }, [companyId, year])

  const fetchRows = (targetPage: number) => {
    if (!companyId || !year) return
    setLoading(true)
    apiClient
      .get<LogPage<WebEmpLeaveTypeItem>>('/admin/employee-leave-types', {
        params: { companyId, year, leaveTypeId: leaveTypeId || undefined, page: targetPage, size: PAGE_SIZE },
      })
      .then((res) => setData(res.data))
      .catch((err) => {
        const axiosErr = err as { response?: { data?: string } }
        message.error(axiosErr.response?.data ?? '載入員工假別額度失敗')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchRows(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, year, leaveTypeId, page])

  const openEdit = (row: WebEmpLeaveTypeItem) => {
    setEditing(row)
    form.setFieldsValue({
      startDate: row.startDate,
      endDate: row.endDate,
      availableHours: row.availableHours ?? 0,
      remainingHours: row.remainingHours ?? 0,
      useHours: row.useHours ?? 0,
      descr: row.descr,
    })
  }

  const submitEdit = async () => {
    if (!editing) return
    try {
      const values = await form.validateFields()
      setSaving(true)
      await apiClient.put(`/admin/employee-leave-types/${editing.id}`, values)
      message.success('已更新')
      setEditing(undefined)
      fetchRows(page)
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? '更新失敗')
    } finally {
      setSaving(false)
    }
  }

  const columns: ColumnsType<WebEmpLeaveTypeItem> = [
    { title: '員工編號', dataIndex: 'employeeNum', key: 'employeeNum' },
    { title: '姓名', dataIndex: 'employeeChname', key: 'employeeChname' },
    { title: '假別', dataIndex: 'leaveTypeName', key: 'leaveTypeName' },
    { title: '起日', dataIndex: 'startDate', key: 'startDate' },
    { title: '迄日', dataIndex: 'endDate', key: 'endDate' },
    { title: '總額度', dataIndex: 'availableHours', key: 'availableHours' },
    { title: '剩餘時數', dataIndex: 'remainingHours', key: 'remainingHours' },
    { title: '已使用', dataIndex: 'useHours', key: 'useHours' },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => <a onClick={() => openEdit(record)}>編輯</a>,
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f6f8' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '16px 24px',
          background: '#fff',
          borderBottom: '1px solid #eee',
        }}
      >
        <Space>
          <a onClick={() => navigate('/')}>首頁</a>
          <span style={{ fontSize: 18, fontWeight: 600 }}>員工配假維護</span>
        </Space>
      </div>
      <div style={{ padding: 24 }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            style={{ width: 240 }}
            placeholder="選擇公司"
            value={companyId}
            onChange={(v) => {
              setCompanyId(v)
              setPage(0)
            }}
            options={companies.map((c) => ({ value: c.id, label: `${c.companyNum} ${c.chName}` }))}
          />
          <Input
            style={{ width: 120 }}
            value={year}
            onChange={(e) => {
              setYear(e.target.value)
              setPage(0)
            }}
            placeholder="年度"
          />
          <Select
            style={{ width: 200 }}
            placeholder="假別(全部)"
            allowClear
            value={leaveTypeId}
            onChange={(v) => {
              setLeaveTypeId(v)
              setPage(0)
            }}
            options={leaveTypeOptions.map((l) => ({ value: l.leaveTypeId, label: l.leaveTypeName }))}
          />
        </Space>
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
      <Modal
        title={`編輯員工假別額度${editing ? ` - ${editing.employeeChname}/${editing.leaveTypeName}` : ''}`}
        open={!!editing}
        onCancel={() => setEditing(undefined)}
        onOk={submitEdit}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Space style={{ width: '100%' }}>
            <Form.Item name="startDate" label="起日(yyyy-MM-dd)">
              <Input placeholder="2026-01-01" />
            </Form.Item>
            <Form.Item name="endDate" label="迄日(yyyy-MM-dd)">
              <Input placeholder="2026-12-31" />
            </Form.Item>
          </Space>
          <Form.Item
            name="availableHours"
            label="總額度(小時)"
            rules={[{ required: true, message: '請輸入總額度' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="remainingHours"
            label="剩餘時數(小時)"
            rules={[{ required: true, message: '請輸入剩餘時數' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="useHours" label="已使用時數(小時)" rules={[{ required: true, message: '請輸入已使用時數' }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="descr" label="備註">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  )
}
