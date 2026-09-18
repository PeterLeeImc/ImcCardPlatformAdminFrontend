import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Checkbox, Form, Input, Layout, Modal, Select, Space, Switch, Table, Tag, message } from 'antd'
import { DeleteOutlined, EditOutlined, PushpinOutlined, TableOutlined, TeamOutlined, UndoOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  apiClient,
  isAdvisorEditingTemplateCompany,
  isAdvisorRole,
  resolveDefaultCompanyId,
  setOperatingDispatchCase,
  sortCompaniesTemplateLast,
} from '../api/client'
import type { CompanyListItem, DispatchCaseItem, DispatchCaseUpsertRequest, LogPage, ManagerOption } from '../types'
import { formatDateTime } from '../utils/formatDateTime'
import { imcDispatchCaseDetailUrl } from '../utils/imcLinks'
import { compareStrings } from '../utils/tableSort'
import PageHeader from '../components/PageHeader'
import ActionIcon from '../components/ActionIcon'
import ResultCount from '../components/ResultCount'
import PageSizeSelect from '../components/PageSizeSelect'

export default function DispatchCaseList() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [companyId, setCompanyId] = useState<number>()
  const [rows, setRows] = useState<DispatchCaseItem[]>([])
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
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
        } else {
          const defaultCompanyId = resolveDefaultCompanyId(res.data.content)
          if (defaultCompanyId) {
            setCompanyId(defaultCompanyId)
          }
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
      .then((res) => {
        setRows(res.data)
        setPage(0)
      })
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
        jobTitle: row.jobTitle ?? undefined,
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
      title: '確定要刪除這個個案？',
      content: isAdvisorRole()
        ? `個案編號：${row.caseCode}，刪除後系統管理者/系統使用者可以還原。`
        : `個案編號：${row.caseCode}`,
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

  const [settingCurrentId, setSettingCurrentId] = useState<number>()
  const setCurrentDispatchCase = async (row: DispatchCaseItem) => {
    if (!companyId) return
    setSettingCurrentId(row.id)
    try {
      const res = await apiClient.post<{ id: number; companyId: number; label: string }>(
        `/admin/companies/${companyId}/dispatch-cases/${row.id}/set-current`,
      )
      setOperatingDispatchCase(res.data.id, res.data.companyId, res.data.label)
      message.success(`已設定目前操作個案：${res.data.label}`)
    } catch (err) {
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? '設定失敗')
    } finally {
      setSettingCurrentId(undefined)
    }
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

  const templateLocked = isAdvisorEditingTemplateCompany(companies, companyId)

  const columns: ColumnsType<DispatchCaseItem> = [
    {
      title: '序號',
      key: 'seq',
      width: 60,
      render: (_, __, index) => page * pageSize + index + 1,
    },
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
      title: '工作職稱',
      dataIndex: 'jobTitle',
      key: 'jobTitle',
      render: (v: string | null) => v ?? '-',
      sorter: (a, b) => compareStrings(a.jobTitle, b.jobTitle),
    },
    {
      title: '負責使用者',
      key: 'responsibleUserName',
      render: (_, record) =>
        record.responsibleUserName
          ? record.responsibleUserAccount
            ? `${record.responsibleUserAccount} ${record.responsibleUserName}`
            : record.responsibleUserName
          : '-',
      sorter: (a, b) => compareStrings(a.responsibleUserName, b.responsibleUserName),
    },
    {
      title: '員工班段配置',
      dataIndex: 'useCustomSchedule',
      key: 'useCustomSchedule',
      render: (v: boolean) => (v ? '採每月提供排班' : '採標準班表'),
      sorter: (a, b) =>
        compareStrings(a.useCustomSchedule ? '採每月提供排班' : '採標準班表', b.useCustomSchedule ? '採每月提供排班' : '採標準班表'),
    },
    {
      title: '加班換算配置',
      dataIndex: 'defaultOvertimeChangeToCompTime',
      key: 'defaultOvertimeChangeToCompTime',
      render: (v: boolean) => (v ? '補休' : '加班費'),
      sorter: (a, b) =>
        compareStrings(a.defaultOvertimeChangeToCompTime ? '補休' : '加班費', b.defaultOvertimeChangeToCompTime ? '補休' : '加班費'),
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
            <ActionIcon
              title="還原"
              icon={<UndoOutlined />}
              disabled={templateLocked}
              onClick={() => handleRestore(record)}
            />
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
            <ActionIcon
              title="編輯"
              icon={<EditOutlined />}
              disabled={templateLocked}
              onClick={() => openEdit(record)}
            />
            <ActionIcon
              title="刪除"
              icon={<DeleteOutlined />}
              danger
              disabled={templateLocked}
              onClick={() => handleDelete(record)}
            />
            <ActionIcon
              title={settingCurrentId === record.id ? '設定中...' : '設定個案'}
              icon={<PushpinOutlined />}
              disabled={settingCurrentId === record.id}
              onClick={() => setCurrentDispatchCase(record)}
            />
          </Space>
        ),
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f6f8' }}>
      <PageHeader title="個案維護" />
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
          <Space>
            <span>選擇客戶：</span>
            <Select
              style={{ width: 360 }}
              placeholder="選擇客戶"
              value={companyId}
              onChange={setCompanyId}
              options={sortCompaniesTemplateLast(companies).map((c) => ({
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
          <Space>
            <ResultCount count={rows.length} />
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
          dataSource={rows}
          pagination={{
            current: page + 1,
            pageSize,
            total: rows.length,
            showSizeChanger: false,
            onChange: (nextPage) => setPage(nextPage - 1),
          }}
        />
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
          <Form.Item
            name="jobTitle"
            label="工作職稱"
            tooltip="IMC個案人才轉員工時，會把這裡的工作職稱複製給新建立的員工"
          >
            <Input placeholder="工作職稱" />
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
            label="員工班段配置"
            valuePropName="checked"
            tooltip={
              editing !== 'new'
                ? '建立個案時設定後不允許修改'
                : '採標準班表：固定套用這個派遣個案的第一筆班表；採每月提供排班：每個月自行安排班段'
            }
            initialValue={false}
          >
            <Switch checkedChildren="採每月提供排班" unCheckedChildren="採標準班表" disabled={editing !== 'new'} />
          </Form.Item>
          <Form.Item
            name="defaultOvertimeChangeToCompTime"
            label="加班換算配置"
            valuePropName="checked"
            tooltip="這個個案底下的員工送出加班申請時不再自己選擇，一律依這個個案的預設值換算"
            initialValue={false}
          >
            <Switch checkedChildren="補休" unCheckedChildren="加班費" />
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
