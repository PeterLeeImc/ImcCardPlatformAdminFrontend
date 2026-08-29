import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Form, Input, InputNumber, Layout, Modal, Select, Space, Table, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { apiClient } from '../api/client'
import type { CompanyListItem, LogPage, WebLeaveTypeItem, WebLeaveTypeUpdateRequest } from '../types'
import { ANNUAL_EFFECTIVE_DATE_OPTIONS, EMPLOYEE_STYLE_OPTIONS, SET_MODE_OPTIONS } from '../types'

const CURRENT_YEAR = String(new Date().getFullYear())

export default function CompanyLeaveTypeList() {
  const navigate = useNavigate()
  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [companyId, setCompanyId] = useState<number>()
  const [year, setYear] = useState(CURRENT_YEAR)
  const [rows, setRows] = useState<WebLeaveTypeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [addYearLoading, setAddYearLoading] = useState(false)
  const [syncLoading, setSyncLoading] = useState(false)
  const [editing, setEditing] = useState<WebLeaveTypeItem>()
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<WebLeaveTypeUpdateRequest>()

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
    if (!companyId || !year) return
    setLoading(true)
    apiClient
      .get<WebLeaveTypeItem[]>('/admin/company-leave-types', { params: { companyId, year } })
      .then((res) => setRows(res.data))
      .catch((err) => {
        const axiosErr = err as { response?: { data?: string } }
        message.error(axiosErr.response?.data ?? '載入假別年度規則失敗')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, year])

  const addYear = async () => {
    setAddYearLoading(true)
    try {
      const res = await apiClient.post('/admin/company-leave-types/add-year', null, { params: { year } })
      message.success(res.data ?? '已新增假別年度規則')
      fetchRows()
    } catch (err) {
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? '新增假別年度失敗')
    } finally {
      setAddYearLoading(false)
    }
  }

  const sync = async () => {
    if (!companyId) return
    setSyncLoading(true)
    try {
      const res = await apiClient.post('/admin/company-leave-types/sync', null, { params: { companyId, year } })
      message.success(res.data ?? '已同步員工假別')
    } catch (err) {
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? '同步員工假別失敗')
    } finally {
      setSyncLoading(false)
    }
  }

  const openEdit = (row: WebLeaveTypeItem) => {
    setEditing(row)
    form.setFieldsValue({
      startDate: row.startDate,
      endDate: row.endDate,
      setMode: row.setMode,
      useTime: row.useTime,
      defaultHours: row.defaultHours,
      jobWorkDay: row.jobWorkDay,
      employeeStyle: row.employeeStyle,
      useCode: row.useCode,
      annualEffectiveDate: row.annualEffectiveDate,
      accumulatingLeaveType: row.accumulatingLeaveType,
    })
  }

  const submitEdit = async () => {
    if (!editing) return
    try {
      const values = await form.validateFields()
      setSaving(true)
      await apiClient.put(`/admin/company-leave-types/${editing.id}`, values)
      message.success('已更新')
      setEditing(undefined)
      fetchRows()
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? '更新失敗')
    } finally {
      setSaving(false)
    }
  }

  const columns: ColumnsType<WebLeaveTypeItem> = [
    { title: '假別', dataIndex: 'leaveTypeName', key: 'leaveTypeName' },
    { title: '起日', dataIndex: 'startDate', key: 'startDate' },
    { title: '迄日', dataIndex: 'endDate', key: 'endDate' },
    {
      title: '設定方式',
      dataIndex: 'setMode',
      key: 'setMode',
      render: (v: string) => SET_MODE_OPTIONS.find((o) => o.value === v)?.label ?? v,
    },
    { title: '預設時數', dataIndex: 'defaultHours', key: 'defaultHours' },
    { title: '到職滿(天)', dataIndex: 'jobWorkDay', key: 'jobWorkDay' },
    {
      title: '員工類型',
      dataIndex: 'employeeStyle',
      key: 'employeeStyle',
      render: (v: string) => EMPLOYEE_STYLE_OPTIONS.find((o) => o.value === v)?.label ?? v,
    },
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
          justifyContent: 'space-between',
          padding: '16px 24px',
          background: '#fff',
          borderBottom: '1px solid #eee',
        }}
      >
        <Space>
          <a onClick={() => navigate('/')}>首頁</a>
          <span style={{ fontSize: 18, fontWeight: 600 }}>公司配假維護</span>
        </Space>
      </div>
      <div style={{ padding: 24 }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            style={{ width: 240 }}
            placeholder="選擇公司"
            value={companyId}
            onChange={setCompanyId}
            options={companies.map((c) => ({ value: c.id, label: `${c.companyNum} ${c.chName}` }))}
          />
          <Input style={{ width: 120 }} value={year} onChange={(e) => setYear(e.target.value)} placeholder="年度" />
          <Button loading={addYearLoading} onClick={addYear}>
            新增假別年度
          </Button>
          <Button type="primary" loading={syncLoading} onClick={sync} disabled={!companyId}>
            同步員工假別
          </Button>
        </Space>
        <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={false} />
      </div>
      <Modal
        title="編輯假別年度規則"
        open={!!editing}
        onCancel={() => setEditing(undefined)}
        onOk={submitEdit}
        confirmLoading={saving}
        destroyOnHidden
        width={600}
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
          <Form.Item name="setMode" label="設定方式">
            <Select options={SET_MODE_OPTIONS} allowClear />
          </Form.Item>
          <Form.Item name="defaultHours" label="預設時數">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="jobWorkDay" label="到職滿幾天才適用">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="employeeStyle" label="適用員工類型">
            <Select options={EMPLOYEE_STYLE_OPTIONS} allowClear />
          </Form.Item>
          <Form.Item name="annualEffectiveDate" label="年假生效日規則">
            <Select options={ANNUAL_EFFECTIVE_DATE_OPTIONS} allowClear />
          </Form.Item>
          <Form.Item name="useCode" label="用途代碼">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  )
}
