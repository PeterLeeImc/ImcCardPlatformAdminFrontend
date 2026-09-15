import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Checkbox, Form, Input, Layout, Modal, Select, Space, Switch, Table, Tag, message } from 'antd'
import { DeleteOutlined, EditOutlined, TableOutlined, TeamOutlined, UndoOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { apiClient, isAdvisorRole } from '../api/client'
import type { CompanyListItem, DispatchCaseItem, DispatchCaseUpsertRequest, LogPage, ManagerOption } from '../types'
import { formatDateTime } from '../utils/formatDateTime'
import { imcDispatchCaseDetailUrl } from '../utils/imcLinks'
import { compareStrings } from '../utils/tableSort'
import PageHeader from '../components/PageHeader'
import ActionIcon from '../components/ActionIcon'

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
  const [includeHidden, setIncludeHidden] = useState(false)
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
      .get<DispatchCaseItem[]>(`/admin/companies/${companyId}/dispatch-cases`, { params: { includeHidden } })
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
  }, [companyId, includeHidden])

  const openEdit = (row: DispatchCaseItem | 'new') => {
    setEditing(row)
    if (row === 'new') {
      form.resetFields()
    } else {
      form.setFieldsValue({
        caseCode: row.caseCode,
        responsibleUserId: row.responsibleUserId ?? undefined,
        useCustomSchedule: row.useCustomSchedule,
        defaultOvertimeChangeToCompTime: row.defaultOvertimeChangeToCompTime,
        descr: row.descr ?? undefined,
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
      title: isAdvisorRole() ? '確定要隱藏這個個案？' : '確定要刪除這個個案？',
      content: isAdvisorRole()
        ? `個案編號：${row.caseCode}，隱藏後系統管理者/系統使用者可以還原。`
        : `個案編號：${row.caseCode}`,
      okType: 'danger',
      onOk: async () => {
        try {
          await apiClient.delete(`/admin/companies/${companyId}/dispatch-cases/${row.id}`)
          message.success(isAdvisorRole() ? '已隱藏' : '刪除成功')
          fetchRows()
        } catch (err) {
          const axiosErr = err as { response?: { data?: string } }
          message.error(axiosErr.response?.data ?? '刪除失敗')
        }
      },
    })
  }

  const handleRestore = (row: DispatchCaseItem) => {
    if (!companyId) return
    Modal.confirm({
      title: '確定要還原這個個案？',
      content: `個案編號：${row.caseCode}`,
      onOk: async () => {
        try {
          await apiClient.post(`/admin/companies/${companyId}/dispatch-cases/${row.id}/restore`)
          message.success('已還原')
          fetchRows()
        } catch (err) {
          const axiosErr = err as { response?: { data?: string } }
          message.error(axiosErr.response?.data ?? '還原失敗')
        }
      },
    })
  }

  const columns: ColumnsType<DispatchCaseItem> = [
    {
      title: '個案編號',
      dataIndex: 'caseCode',
      key: 'caseCode',
      render: (v: string, record) => (
        <>
          <a href={imcDispatchCaseDetailUrl(v)} target="_blank" rel="noreferrer">
            {v}
          </a>
          {record.hidden && (
            <Tag color="default" style={{ marginLeft: 8 }}>
              已隱藏
            </Tag>
          )}
        </>
      ),
      sorter: (a, b) => compareStrings(a.caseCode, b.caseCode),
    },
    {
      title: '負責使用者',
      dataIndex: 'responsibleUserName',
      key: 'responsibleUserName',
      sorter: (a, b) => compareStrings(a.responsibleUserName, b.responsibleUserName),
    },
    {
      title: '班段採首筆班表或每月自訂',
      dataIndex: 'useCustomSchedule',
      key: 'useCustomSchedule',
      render: (v: boolean) => (v ? '每月自訂' : '首筆班表'),
      sorter: (a, b) =>
        compareStrings(a.useCustomSchedule ? '每月自訂' : '首筆班表', b.useCustomSchedule ? '每月自訂' : '首筆班表'),
    },
    {
      title: '加班預設換算',
      dataIndex: 'defaultOvertimeChangeToCompTime',
      key: 'defaultOvertimeChangeToCompTime',
      render: (v: boolean) => (v ? '補休' : '加班費(現金)'),
      sorter: (a, b) =>
        compareStrings(a.defaultOvertimeChangeToCompTime ? '補休' : '加班費(現金)', b.defaultOvertimeChangeToCompTime ? '補休' : '加班費(現金)'),
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
      render: (_, record) =>
        record.hidden ? (
          <Space size="small">
            <ActionIcon title="還原" icon={<UndoOutlined />} onClick={() => handleRestore(record)} />
          </Space>
        ) : (
          <Space size="small">
            <ActionIcon
              title="班表"
              icon={<TableOutlined />}
              onClick={() => navigate(`/time-schedules?companyId=${companyId}&dispatchCaseId=${record.id}`)}
            />
            <ActionIcon
              title="員工"
              icon={<TeamOutlined />}
              onClick={() => navigate(`/employees?companyId=${companyId}&dispatchCaseId=${record.id}`)}
            />
            <ActionIcon title="編輯" icon={<EditOutlined />} onClick={() => openEdit(record)} />
            <ActionIcon title="刪除" icon={<DeleteOutlined />} danger onClick={() => handleDelete(record)} />
          </Space>
        ),
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f6f8' }}>
      <PageHeader
        title="個案維護"
        actions={
          <Button type="primary" onClick={() => openEdit('new')} disabled={!companyId}>
            新增個案
          </Button>
        }
      />
      <div style={{ padding: 24 }}>
        <Space style={{ marginBottom: 16 }}>
          <span>選擇客戶：</span>
          <Select
            style={{ width: 360 }}
            placeholder="選擇客戶"
            value={companyId}
            onChange={setCompanyId}
            options={companies.map((c) => ({
              value: c.id,
              label: c.template ? `[樣板] ${c.companyNum} ${c.chName}` : `${c.companyNum} ${c.chName}`,
            }))}
          />
          {!isAdvisorRole() && (
            <Checkbox checked={includeHidden} onChange={(e) => setIncludeHidden(e.target.checked)}>
              顯示已隱藏項目
            </Checkbox>
          )}
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
            name="useCustomSchedule"
            label="班段採首筆班表或每月自訂"
            valuePropName="checked"
            tooltip="首筆班表：固定套用這個派遣個案的第一筆班表；每月自訂：每個月自行安排班段"
            initialValue={false}
          >
            <Switch checkedChildren="每月自訂" unCheckedChildren="首筆班表" />
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
          <Form.Item name="descr" label="備註">
            <Input.TextArea placeholder="備註" rows={3} />
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
