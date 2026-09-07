import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Form, Input, Layout, Modal, Select, Space, Switch, Table, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { apiClient, isAdvisorRole } from '../api/client'
import type { CompanyListItem, DispatchCaseItem, DispatchCaseUpsertRequest, LogPage, ManagerOption } from '../types'
import { formatDateTime } from '../utils/formatDateTime'

export default function DispatchCaseList() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [companyId, setCompanyId] = useState<number>()
  const [rows, setRows] = useState<DispatchCaseItem[]>([])
  const [managerOptions, setManagerOptions] = useState<ManagerOption[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<DispatchCaseItem | 'new'>()
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<DispatchCaseUpsertRequest>()

  useEffect(() => {
    apiClient
      .get<LogPage<CompanyListItem>>('/admin/companies', { params: { page: 0, size: 200 } })
      .then((res) => {
        setCompanies(res.data.content)
        const fromUrl = Number(searchParams.get('companyId'))
        if (fromUrl && res.data.content.some((c) => c.id === fromUrl)) {
          setCompanyId(fromUrl)
        } else if (res.data.content.length > 0) {
          setCompanyId(res.data.content[0].id)
        }
      })
      .catch(() => message.error('載入客戶清單失敗'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchRows = () => {
    if (!companyId) return
    setLoading(true)
    apiClient
      .get<DispatchCaseItem[]>(`/admin/companies/${companyId}/dispatch-cases`)
      .then((res) => setRows(res.data))
      .catch((err) => {
        const axiosErr = err as { response?: { data?: string } }
        message.error(axiosErr.response?.data ?? '載入個案清單失敗')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchRows()
    if (companyId) {
      apiClient
        .get<ManagerOption[]>(`/admin/companies/${companyId}/dispatch-cases/responsible-user-options`)
        .then((res) => setManagerOptions(res.data))
        .catch(() => setManagerOptions([]))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  const openEdit = (row: DispatchCaseItem | 'new') => {
    setEditing(row)
    if (row === 'new') {
      form.resetFields()
    } else {
      form.setFieldsValue({
        caseCode: row.caseCode,
        responsibleUserId: row.responsibleUserId ?? undefined,
        defaultOvertimeChangeToCompTime: row.defaultOvertimeChangeToCompTime,
      })
    }
  }

  const submitEdit = async () => {
    if (!editing || !companyId) return
    try {
      const values = await form.validateFields()
      setSaving(true)
      if (editing === 'new') {
        await apiClient.post(`/admin/companies/${companyId}/dispatch-cases`, values)
        message.success('已新增個案')
      } else {
        await apiClient.put(`/admin/companies/${companyId}/dispatch-cases/${editing.id}`, values)
        message.success('已更新個案')
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

  const handleDelete = (row: DispatchCaseItem) => {
    if (!companyId) return
    Modal.confirm({
      title: '確定要刪除這個個案？',
      content: `個案編號：${row.caseCode}`,
      okType: 'danger',
      onOk: async () => {
        try {
          await apiClient.delete(`/admin/companies/${companyId}/dispatch-cases/${row.id}`)
          message.success('刪除成功')
          fetchRows()
        } catch (err) {
          const axiosErr = err as { response?: { data?: string } }
          message.error(axiosErr.response?.data ?? '刪除失敗')
        }
      },
    })
  }

  const columns: ColumnsType<DispatchCaseItem> = [
    { title: '個案編號', dataIndex: 'caseCode', key: 'caseCode' },
    { title: '負責使用者', dataIndex: 'responsibleUserName', key: 'responsibleUserName' },
    {
      title: '加班預設換算',
      dataIndex: 'defaultOvertimeChangeToCompTime',
      key: 'defaultOvertimeChangeToCompTime',
      render: (v: boolean) => (v ? '補休' : '加班費(現金)'),
    },
    { title: '建立時間', dataIndex: 'createdAt', key: 'createdAt', render: formatDateTime },
    { title: '建立者', dataIndex: 'createdBy', key: 'createdBy' },
    { title: '異動時間', dataIndex: 'updatedAt', key: 'updatedAt', render: formatDateTime },
    { title: '異動者', dataIndex: 'updatedBy', key: 'updatedBy' },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <a onClick={() => navigate(`/companies/${companyId}/dispatch-cases/${record.id}/time-schedules`)}>班表</a>
          <a onClick={() => navigate(`/employees?companyId=${companyId}&dispatchCaseId=${record.id}`)}>員工</a>
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
          <span style={{ fontSize: 18, fontWeight: 600 }}>個案維護</span>
        </Space>
        <Button type="primary" onClick={() => openEdit('new')} disabled={!companyId || isAdvisorRole()}>
          新增個案
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
        title={editing === 'new' ? '新增個案' : '編輯個案'}
        open={!!editing}
        onCancel={() => setEditing(undefined)}
        onOk={submitEdit}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="caseCode" label="個案編號" tooltip="IMC個案編號" rules={[{ required: true, message: '請輸入個案編號' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="responsibleUserId" label="負責使用者">
            <Select
              allowClear
              placeholder="選擇負責使用者(僅列啟用中的帳號)"
              options={managerOptions.map((m) => ({ value: m.id, label: `${m.account} ${m.username}` }))}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item
            name="defaultOvertimeChangeToCompTime"
            label="加班申請核准後預設換算方式"
            valuePropName="checked"
            tooltip="這個個案底下的員工送出加班申請時不再自己選擇，一律依這個個案的預設值換算"
            initialValue={false}
          >
            <Switch checkedChildren="換算成補休" unCheckedChildren="換算成加班費(現金)" />
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
