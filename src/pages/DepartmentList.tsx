import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Form, Input, Layout, Modal, Select, Space, Table, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { apiClient } from '../api/client'
import type { ComDepartmentItem, ComDepartmentUpsertRequest, CompanyListItem, EmployeeListItem, LogPage } from '../types'

export default function DepartmentList() {
  const navigate = useNavigate()
  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [companyId, setCompanyId] = useState<number>()
  const [rows, setRows] = useState<ComDepartmentItem[]>([])
  const [employees, setEmployees] = useState<EmployeeListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<ComDepartmentItem | 'new'>()
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<ComDepartmentUpsertRequest>()

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
      .get<ComDepartmentItem[]>(`/admin/companies/${companyId}/departments`)
      .then((res) => setRows(res.data))
      .catch((err) => {
        const axiosErr = err as { response?: { data?: string } }
        message.error(axiosErr.response?.data ?? '載入部門清單失敗')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchRows()
    if (companyId) {
      apiClient
        .get<LogPage<EmployeeListItem>>('/admin/employees', { params: { companyId, page: 0, size: 500 } })
        .then((res) => setEmployees(res.data.content))
        .catch(() => setEmployees([]))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  const openEdit = (row: ComDepartmentItem | 'new') => {
    setEditing(row)
    if (row === 'new') {
      form.resetFields()
    } else {
      form.setFieldsValue({ deptId: row.deptId, deptName: row.deptName, managerId: row.managerId ?? undefined })
    }
  }

  const submitEdit = async () => {
    if (!editing || !companyId) return
    try {
      const values = await form.validateFields()
      setSaving(true)
      if (editing === 'new') {
        await apiClient.post(`/admin/companies/${companyId}/departments`, values)
        message.success('已新增部門')
      } else {
        await apiClient.put(`/admin/companies/${companyId}/departments/${editing.id}`, values)
        message.success('已更新部門')
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

  const handleDelete = (row: ComDepartmentItem) => {
    if (!companyId) return
    Modal.confirm({
      title: '確定要刪除這個部門？',
      content: `部門：${row.deptName}`,
      okType: 'danger',
      onOk: async () => {
        try {
          await apiClient.delete(`/admin/companies/${companyId}/departments/${row.id}`)
          message.success('刪除成功')
          fetchRows()
        } catch (err) {
          const axiosErr = err as { response?: { data?: string } }
          message.error(axiosErr.response?.data ?? '刪除失敗')
        }
      },
    })
  }

  const columns: ColumnsType<ComDepartmentItem> = [
    { title: '部門代碼', dataIndex: 'deptId', key: 'deptId' },
    { title: '部門名稱', dataIndex: 'deptName', key: 'deptName' },
    { title: '部門主管', dataIndex: 'managerName', key: 'managerName' },
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
          <span style={{ fontSize: 18, fontWeight: 600 }}>部門主檔</span>
        </Space>
        <Button type="primary" onClick={() => openEdit('new')} disabled={!companyId}>
          新增部門
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
        title={editing === 'new' ? '新增部門' : '編輯部門'}
        open={!!editing}
        onCancel={() => setEditing(undefined)}
        onOk={submitEdit}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="deptId" label="部門代碼" rules={[{ required: true, message: '請輸入部門代碼' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="deptName" label="部門名稱" rules={[{ required: true, message: '請輸入部門名稱' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="managerId" label="部門主管">
            <Select
              allowClear
              placeholder="選擇部門主管"
              options={employees.map((e) => ({ value: e.id, label: `${e.employeenum} ${e.chname}` }))}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  )
}
