import { useEffect, useState } from 'react'
import { Button, Checkbox, Form, Input, Layout, Modal, Select, Space, Table, Tag, message } from 'antd'
import { DeleteOutlined, EditOutlined, UndoOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { apiClient, isAdvisorRole } from '../api/client'
import type { CompanyListItem, DispatchCaseItem, LogPage, WorkOvertimeItem, WorkOvertimeUpsertRequest } from '../types'
import { formatDateTime } from '../utils/formatDateTime'
import { compareStrings } from '../utils/tableSort'
import PageHeader from '../components/PageHeader'
import ActionIcon from '../components/ActionIcon'

export default function WorkOvertimeList() {
  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [companyId, setCompanyId] = useState<number>()
  const [dispatchCases, setDispatchCases] = useState<DispatchCaseItem[]>([])
  const [dispatchCaseId, setDispatchCaseId] = useState<number>()
  const [rows, setRows] = useState<WorkOvertimeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<WorkOvertimeItem | 'new'>()
  const [saving, setSaving] = useState(false)
  const [copying, setCopying] = useState(false)
  const [includeHidden, setIncludeHidden] = useState(false)
  const [form] = Form.useForm<WorkOvertimeUpsertRequest>()

  const templateCompany = companies.find((c) => c.template)
  const canCopyFromTemplate = !!templateCompany && !!companyId && !!dispatchCaseId && templateCompany.id !== companyId

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

  useEffect(() => {
    if (!companyId) return
    apiClient
      .get<DispatchCaseItem[]>(`/admin/companies/${companyId}/dispatch-cases`)
      .then((res) => {
        setDispatchCases(res.data)
        setDispatchCaseId(res.data.length > 0 ? res.data[0].id : undefined)
      })
      .catch(() => setDispatchCases([]))
  }, [companyId])

  const fetchRows = () => {
    if (!dispatchCaseId) {
      setRows([])
      return
    }
    setLoading(true)
    apiClient
      .get<WorkOvertimeItem[]>('/admin/work-overtimes', { params: { dispatchCaseId, includeHidden } })
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
  }, [dispatchCaseId, includeHidden])

  const openEdit = (row: WorkOvertimeItem | 'new') => {
    setEditing(row)
    if (row === 'new') {
      form.resetFields()
    } else {
      form.setFieldsValue({ chName: row.chName, descr: row.descr ?? undefined })
    }
  }

  const submitEdit = async () => {
    if (!editing || !dispatchCaseId) return
    try {
      const values = await form.validateFields()
      setSaving(true)
      if (editing === 'new') {
        await apiClient.post('/admin/work-overtimes', values, { params: { dispatchCaseId } })
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

  const copyFromTemplate = () => {
    if (!templateCompany || !dispatchCaseId) return
    Modal.confirm({
      title: '確定要從樣板客戶複製加班別？',
      content: `樣板客戶：${templateCompany.chName}，同名的加班別不會重複複製，複製後可自行修改。`,
      onOk: async () => {
        setCopying(true)
        try {
          const res = await apiClient.post<{ copied: number }>('/admin/work-overtimes/copy-from-template', null, {
            params: { dispatchCaseId },
          })
          message.success(`已複製 ${res.data.copied} 筆加班別`)
          fetchRows()
        } catch (err) {
          const axiosErr = err as { response?: { data?: string } }
          message.error(axiosErr.response?.data ?? '複製失敗')
        } finally {
          setCopying(false)
        }
      },
    })
  }

  const handleDelete = (row: WorkOvertimeItem) => {
    Modal.confirm({
      title: isAdvisorRole() ? '確定要隱藏這個加班別？' : '確定要刪除這個加班別？',
      content: isAdvisorRole()
        ? `加班別：${row.chName}，隱藏後系統管理者/系統使用者可以還原。`
        : `加班別：${row.chName}`,
      okType: 'danger',
      onOk: async () => {
        try {
          await apiClient.delete(`/admin/work-overtimes/${row.id}`)
          message.success(isAdvisorRole() ? '已隱藏' : '刪除成功')
          fetchRows()
        } catch (err) {
          const axiosErr = err as { response?: { data?: string } }
          message.error(axiosErr.response?.data ?? '刪除失敗')
        }
      },
    })
  }

  const handleRestore = (row: WorkOvertimeItem) => {
    Modal.confirm({
      title: '確定要還原這個加班別？',
      content: `加班別：${row.chName}`,
      onOk: async () => {
        try {
          await apiClient.post(`/admin/work-overtimes/${row.id}/restore`)
          message.success('已還原')
          fetchRows()
        } catch (err) {
          const axiosErr = err as { response?: { data?: string } }
          message.error(axiosErr.response?.data ?? '還原失敗')
        }
      },
    })
  }

  const columns: ColumnsType<WorkOvertimeItem> = [
    {
      title: '加班別名稱',
      dataIndex: 'chName',
      key: 'chName',
      render: (v: string, record) => (
        <>
          {v}
          {record.hidden && (
            <Tag color="default" style={{ marginLeft: 8 }}>
              已隱藏
            </Tag>
          )}
        </>
      ),
      sorter: (a, b) => compareStrings(a.chName, b.chName),
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
            <ActionIcon title="編輯" icon={<EditOutlined />} onClick={() => openEdit(record)} />
            <ActionIcon title="刪除" icon={<DeleteOutlined />} danger onClick={() => handleDelete(record)} />
          </Space>
        ),
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f6f8' }}>
      <PageHeader
        title="加班別維護"
        actions={
          <Button type="primary" onClick={() => openEdit('new')} disabled={!dispatchCaseId}>
            新增加班別
          </Button>
        }
      />
      <div style={{ padding: 24 }}>
        <Space style={{ marginBottom: 16 }} wrap>
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
          <span>選擇個案：</span>
          <Select
            style={{ width: 200 }}
            placeholder="選擇個案"
            value={dispatchCaseId}
            onChange={setDispatchCaseId}
            options={dispatchCases.map((d) => ({ value: d.id, label: d.caseCode }))}
          />
          <Button onClick={copyFromTemplate} loading={copying} disabled={!canCopyFromTemplate}>
            複製樣板客戶加班別
          </Button>
          {!isAdvisorRole() && (
            <Checkbox checked={includeHidden} onChange={(e) => setIncludeHidden(e.target.checked)}>
              顯示已隱藏項目
            </Checkbox>
          )}
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
