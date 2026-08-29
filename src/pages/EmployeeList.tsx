import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Form, Input, Layout, Modal, Select, Space, Table, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { apiClient } from '../api/client'
import type { CompanyListItem, EmployeeListItem, LogPage } from '../types'
import { JOB_STATUS_OPTIONS } from '../types'

const PAGE_SIZE = 20

export default function EmployeeList() {
  const navigate = useNavigate()
  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [companyId, setCompanyId] = useState<number>()
  const [employeenum, setEmployeenum] = useState('')
  const [chname, setChname] = useState('')
  const [jobStatus, setJobStatus] = useState<string>()
  const [data, setData] = useState<LogPage<EmployeeListItem>>()
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [resetTarget, setResetTarget] = useState<EmployeeListItem>()
  const [resetLoading, setResetLoading] = useState(false)
  const [resetForm] = Form.useForm<{ newPassword: string }>()

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

  const fetchRows = (targetPage: number) => {
    if (!companyId) return
    setLoading(true)
    apiClient
      .get<LogPage<EmployeeListItem>>('/admin/employees', {
        params: {
          companyId,
          employeenum: employeenum || undefined,
          chname: chname || undefined,
          jobStatus: jobStatus || undefined,
          page: targetPage,
          size: PAGE_SIZE,
        },
      })
      .then((res) => setData(res.data))
      .catch((err) => {
        const axiosErr = err as { response?: { data?: string } }
        message.error(axiosErr.response?.data ?? '載入員工清單失敗')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchRows(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, page])

  const onSearch = () => {
    setPage(0)
    fetchRows(0)
  }

  const openResetPassword = (record: EmployeeListItem) => {
    resetForm.resetFields()
    setResetTarget(record)
  }

  const submitResetPassword = async () => {
    if (!resetTarget) return
    try {
      const values = await resetForm.validateFields()
      setResetLoading(true)
      await apiClient.post(`/admin/employees/${resetTarget.id}/reset-password`, { newPassword: values.newPassword })
      message.success('密碼已重設')
      setResetTarget(undefined)
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? '重設密碼失敗')
    } finally {
      setResetLoading(false)
    }
  }

  const handleDelete = (record: EmployeeListItem) => {
    Modal.confirm({
      title: '確定要刪除此員工？',
      content: `員工編號：${record.employeenum}`,
      okType: 'danger',
      onOk: async () => {
        try {
          await apiClient.delete(`/admin/employees/${record.id}`)
          message.success('刪除成功')
          fetchRows(page)
        } catch (err) {
          const axiosErr = err as { response?: { data?: string } }
          message.error(axiosErr.response?.data ?? '刪除失敗')
        }
      },
    })
  }

  const columns: ColumnsType<EmployeeListItem> = [
    { title: '員工編號', dataIndex: 'employeenum', key: 'employeenum' },
    { title: '姓名', dataIndex: 'chname', key: 'chname' },
    { title: '部門', dataIndex: 'departmentName', key: 'departmentName' },
    { title: '角色', dataIndex: 'roleLabel', key: 'roleLabel' },
    { title: '在職狀態', dataIndex: 'jobStatusLabel', key: 'jobStatusLabel' },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <a onClick={() => navigate(`/employees/${record.id}`)}>編輯</a>
          <a onClick={() => openResetPassword(record)}>重設密碼</a>
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
          <span style={{ fontSize: 18, fontWeight: 600 }}>員工維護</span>
        </Space>
        <Button type="primary" onClick={() => navigate('/employees/new')} disabled={!companyId}>
          新增員工
        </Button>
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
            style={{ width: 160 }}
            placeholder="員工編號"
            value={employeenum}
            onChange={(e) => setEmployeenum(e.target.value)}
          />
          <Input style={{ width: 160 }} placeholder="姓名" value={chname} onChange={(e) => setChname(e.target.value)} />
          <Select
            style={{ width: 140 }}
            placeholder="在職狀態(全部)"
            allowClear
            value={jobStatus}
            onChange={setJobStatus}
            options={JOB_STATUS_OPTIONS}
          />
          <Button type="primary" onClick={onSearch}>
            查詢
          </Button>
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
        title={`重設密碼${resetTarget ? ` - ${resetTarget.employeenum}` : ''}`}
        open={!!resetTarget}
        onCancel={() => setResetTarget(undefined)}
        onOk={submitResetPassword}
        confirmLoading={resetLoading}
        destroyOnHidden
      >
        <Form form={resetForm} layout="vertical">
          <Form.Item
            name="newPassword"
            label="新密碼"
            rules={[
              { required: true, message: '請輸入新密碼' },
              { pattern: /^[a-zA-Z][0-9a-zA-Z]{3,}$/, message: '需以英文字母開頭，長度至少4碼，且只能是英文字母或數字' },
            ]}
          >
            <Input.Password placeholder="新密碼" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  )
}
