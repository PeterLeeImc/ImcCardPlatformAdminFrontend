import { useEffect, useState } from 'react'
import { Button, DatePicker, Form, Input, Layout, Modal, Popconfirm, Select, Space, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { Dayjs } from 'dayjs'
import { apiClient, isAdvisorEditingTemplateCompany } from '../api/client'
import type { AdminApprovalDelegateRow } from '../types'
import { formatDate } from '../utils/formatDate'
import { compareDates, compareStrings } from '../utils/tableSort'
import { ALL_EMPLOYEES, useCompanyCaseEmployee } from '../hooks/useCompanyCaseEmployee'
import PageHeader from '../components/PageHeader'
import ResultCount from '../components/ResultCount'
import PageSizeSelect from '../components/PageSizeSelect'

const DATE_FORMAT = 'YYYY/MM/DD'
const WIRE_DATE_FORMAT = 'YYYY-MM-DD'

const STATUS_COLOR: Record<string, string> = { 生效中: 'green', 未開始: 'blue', 已結束: 'default' }

interface CreateFormValues {
  employeeId: number
  period: [Dayjs, Dayjs]
  delegateEmployeenum: string
}

/**
 * 打卡平台管理端「簽核代理人維護」：管理者幫任一位員工設定/取消簽核代理人(員工自己也能在打卡RWD
 * 「簽核代理人」設定，兩邊操作的是同一份資料)。篩選方式比照「員工每日打卡」(客戶/個案/員工)，
 * 選好篩選條件就自動載入清單。
 */
export default function ApprovalDelegateList() {
  const { companies, companyId, dispatchCaseId, employees, employeeId, selects } = useCompanyCaseEmployee()
  const [rows, setRows] = useState<AdminApprovalDelegateRow[]>([])
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<CreateFormValues>()

  const fetchRows = () => {
    if (!companyId) return
    setLoading(true)
    apiClient
      .get<AdminApprovalDelegateRow[]>('/admin/approval-delegates', {
        params: { companyId, dispatchCaseId: dispatchCaseId ?? 0, employeeId },
      })
      .then((res) => {
        setRows(res.data)
        setPage(0)
      })
      .catch((err) => {
        const axiosErr = err as { response?: { data?: string } }
        message.error(axiosErr.response?.data ?? '查詢失敗')
      })
      .finally(() => setLoading(false))
  }

  // 篩選條件一變就重新載入(換客戶時個案/員工會連鎖重置，這裡會多觸發幾次，都是便宜的查詢)。
  useEffect(() => {
    fetchRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, dispatchCaseId, employeeId])

  const templateLocked = isAdvisorEditingTemplateCompany(companies, companyId)

  const openCreate = () => {
    form.resetFields()
    if (employeeId !== ALL_EMPLOYEES) {
      form.setFieldsValue({ employeeId })
    }
    setModalOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      await apiClient.post('/admin/approval-delegates', {
        employeeId: values.employeeId,
        delegateEmployeenum: values.delegateEmployeenum.trim(),
        startDate: values.period[0].format(WIRE_DATE_FORMAT),
        endDate: values.period[1].format(WIRE_DATE_FORMAT),
      })
      message.success('已設定簽核代理人')
      setModalOpen(false)
      fetchRows()
    } catch (err) {
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? '設定失敗')
    } finally {
      setSaving(false)
    }
  }

  const cancelDelegate = async (record: AdminApprovalDelegateRow) => {
    try {
      await apiClient.delete(`/admin/approval-delegates/${record.id}`)
      message.success('已取消')
      fetchRows()
    } catch (err) {
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? '取消失敗')
    }
  }

  const columns: ColumnsType<AdminApprovalDelegateRow> = [
    {
      title: '序號',
      key: 'seq',
      width: 60,
      render: (_, __, index) => page * pageSize + index + 1,
    },
    {
      title: '被代理人員工編號',
      dataIndex: 'employeeNum',
      key: 'employeeNum',
      sorter: (a, b) => compareStrings(a.employeeNum, b.employeeNum),
    },
    {
      title: '被代理人姓名',
      dataIndex: 'employeeChname',
      key: 'employeeChname',
      sorter: (a, b) => compareStrings(a.employeeChname, b.employeeChname),
    },
    {
      title: '開始日期',
      dataIndex: 'startDate',
      key: 'startDate',
      render: formatDate,
      sorter: (a, b) => compareDates(a.startDate, b.startDate),
    },
    {
      title: '結束日期',
      dataIndex: 'endDate',
      key: 'endDate',
      render: formatDate,
      sorter: (a, b) => compareDates(a.endDate, b.endDate),
    },
    {
      title: '代理人員工編號',
      dataIndex: 'delegateEmployeenum',
      key: 'delegateEmployeenum',
      sorter: (a, b) => compareStrings(a.delegateEmployeenum, b.delegateEmployeenum),
    },
    {
      title: '代理人姓名',
      dataIndex: 'delegateChname',
      key: 'delegateChname',
      sorter: (a, b) => compareStrings(a.delegateChname, b.delegateChname),
    },
    {
      title: '狀態',
      dataIndex: 'statusName',
      key: 'statusName',
      render: (v: string) => <Tag color={STATUS_COLOR[v] ?? 'default'}>{v}</Tag>,
      sorter: (a, b) => compareStrings(a.statusName, b.statusName),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Popconfirm
          title={`確定要取消 ${formatDate(record.startDate)}~${formatDate(record.endDate)} 由 ${record.delegateChname}(${record.delegateEmployeenum}) 代理 ${record.employeeChname} 的設定？`}
          okText="取消這筆設定"
          cancelText="返回"
          onConfirm={() => cancelDelegate(record)}
          disabled={templateLocked}
        >
          <Button type="link" danger disabled={templateLocked}>
            取消設定
          </Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f6f8' }}>
      <PageHeader title="簽核代理人維護" />
      <div style={{ padding: 24 }}>
        <Space style={{ marginBottom: 16 }} wrap>
          {selects}
          <Button type="primary" onClick={openCreate} disabled={!companyId || templateLocked}>
            新增代理設定
          </Button>
        </Space>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
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
        title="新增簽核代理設定"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={submit}
        confirmLoading={saving}
        okText="設定代理人"
        cancelText="取消"
        // forceRender：讓Form一直掛著，openCreate()在Modal打開前呼叫resetFields/setFieldsValue才有效。
        forceRender
      >
        <p style={{ color: '#666', fontSize: 13 }}>
          設定期間內，被代理人負責簽核的請假/加班/補卡申請，會改由代理人處理：期間內被代理人自己看不到這些待簽核申請、也不能簽核(依查詢/簽核當下的日期判斷是否落在代理期間內，不是申請單本身的起訖日期)。
        </p>
        <Form form={form} layout="vertical">
          <Form.Item name="employeeId" label="被代理人" rules={[{ required: true, message: '請選擇被代理人' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="選擇被代理人(依上方客戶/個案篩選的員工)"
              options={employees.map((e) => ({ value: e.id, label: `${e.employeenum} ${e.chname}` }))}
            />
          </Form.Item>
          <Form.Item name="period" label="代理期間" rules={[{ required: true, message: '請選擇代理期間' }]}>
            <DatePicker.RangePicker format={DATE_FORMAT} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="delegateEmployeenum"
            label="代理人員工編號"
            rules={[{ required: true, whitespace: true, message: '請輸入代理人的員工編號' }]}
          >
            <Input placeholder="請輸入代理人的員工編號" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  )
}
