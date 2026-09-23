import { useCallback, useEffect, useState } from 'react'
import { Button, DatePicker, Form, Input, Layout, Modal, Select, Space, Table, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { Dayjs } from 'dayjs'
import {
  apiClient,
  resolveDefaultCompanyId,
  resolveDefaultDispatchCaseId,
  sortCompaniesTemplateLast,
} from '../api/client'
import type {
  AdminNotificationItem,
  BroadcastNotificationRequest,
  CompanyListItem,
  DispatchCaseItem,
  EmployeeListItem,
  LogPage,
} from '../types'
import { compareDates, compareStrings } from '../utils/tableSort'
import PageHeader from '../components/PageHeader'
import ResultCount from '../components/ResultCount'
import PageSizeSelect from '../components/PageSizeSelect'

const ALL = 'ALL' as const
type Choice = number | typeof ALL

export default function NotificationBroadcast() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<LogPage<AdminNotificationItem>>()
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  // 「已發送」清單的篩選條件：客戶必選(當作查詢範圍)，個案/員工/發送人/主旨/內容/發送時間/
  // 已讀時間都是選填的進一步篩選。
  const [listCompanies, setListCompanies] = useState<CompanyListItem[]>([])
  const [listCompanyId, setListCompanyId] = useState<number>()
  const [filterDispatchCases, setFilterDispatchCases] = useState<DispatchCaseItem[]>([])
  const [filterDispatchCaseId, setFilterDispatchCaseId] = useState<number>()
  const [filterEmployees, setFilterEmployees] = useState<EmployeeListItem[]>([])
  const [filterEmployeeId, setFilterEmployeeId] = useState<number>()
  const [filterSender, setFilterSender] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [filterContent, setFilterContent] = useState('')
  const [filterSentRange, setFilterSentRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [filterReadRange, setFilterReadRange] = useState<[Dayjs, Dayjs] | null>(null)

  // 發送廣播用的三層選擇，每一層第一個選項都是「全部」。
  const [composeOpen, setComposeOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [companyId, setCompanyId] = useState<Choice>(ALL)
  const [dispatchCases, setDispatchCases] = useState<DispatchCaseItem[]>([])
  const [dispatchCaseId, setDispatchCaseId] = useState<Choice>(ALL)
  const [employees, setEmployees] = useState<EmployeeListItem[]>([])
  const [employeeId, setEmployeeId] = useState<Choice>(ALL)
  const [form] = Form.useForm<{ subject: string; content: string }>()

  useEffect(() => {
    apiClient
      .get<LogPage<CompanyListItem>>('/admin/companies', { params: { page: 0, size: 200 } })
      .then((res) => {
        setListCompanies(res.data.content)
        setCompanies(res.data.content)
        const defaultCompanyId = resolveDefaultCompanyId(res.data.content)
        if (defaultCompanyId) {
          setListCompanyId(defaultCompanyId)
        }
      })
      .catch(() => message.error('載入客戶清單失敗'))
  }, [])

  interface NotificationFilters {
    dispatchCaseId?: number
    employeeId?: number
    sender: string
    subject: string
    content: string
    sentRange: [Dayjs, Dayjs] | null
    readRange: [Dayjs, Dayjs] | null
  }

  // fetchNotifications吃「明確傳入的篩選值」而不是直接讀取state closure，是因為clearFilters()
  // 一次要重置好幾個篩選欄位再立刻查詢，若改成讀取state會抓到reset前那次render的舊值(React
  // 的setState是非同步、批次生效的)，明確傳參數才能確保查到的是清空後的最新條件。
  const fetchNotifications = useCallback(
    async (targetPage: number, overrides?: Partial<NotificationFilters>) => {
      if (!listCompanyId) return
      const f: NotificationFilters = {
        dispatchCaseId: filterDispatchCaseId,
        employeeId: filterEmployeeId,
        sender: filterSender,
        subject: filterSubject,
        content: filterContent,
        sentRange: filterSentRange,
        readRange: filterReadRange,
        ...overrides,
      }
      setLoading(true)
      try {
        const res = await apiClient.get<LogPage<AdminNotificationItem>>('/admin/notifications', {
          params: {
            companyId: listCompanyId,
            dispatchCaseId: f.dispatchCaseId,
            employeeId: f.employeeId,
            sender: f.sender || undefined,
            subject: f.subject || undefined,
            content: f.content || undefined,
            sentFrom: f.sentRange?.[0]?.format('YYYY-MM-DD'),
            sentTo: f.sentRange?.[1]?.format('YYYY-MM-DD'),
            readFrom: f.readRange?.[0]?.format('YYYY-MM-DD'),
            readTo: f.readRange?.[1]?.format('YYYY-MM-DD'),
            page: targetPage,
            size: pageSize,
          },
        })
        setData(res.data)
      } catch (err) {
        const axiosErr = err as { response?: { data?: string } }
        message.error(axiosErr.response?.data ?? '載入通知紀錄失敗')
      } finally {
        setLoading(false)
      }
    },
    [
      listCompanyId,
      filterDispatchCaseId,
      filterEmployeeId,
      filterSender,
      filterSubject,
      filterContent,
      filterSentRange,
      filterReadRange,
      pageSize,
    ],
  )

  useEffect(() => {
    fetchNotifications(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, listCompanyId, pageSize])

  // 選擇客戶改變時，重置底下的個案/員工篩選，並重新載入這家客戶的派遣個案清單。
  useEffect(() => {
    setFilterDispatchCaseId(undefined)
    setFilterDispatchCases([])
    setFilterEmployeeId(undefined)
    setFilterEmployees([])
    if (!listCompanyId) return
    apiClient
      .get<DispatchCaseItem[]>(`/admin/companies/${listCompanyId}/dispatch-cases`)
      .then((res) => {
        setFilterDispatchCases(res.data)
        setFilterDispatchCaseId(resolveDefaultDispatchCaseId(res.data, listCompanyId))
      })
      .catch(() => setFilterDispatchCases([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listCompanyId])

  // 選擇個案改變時，重置員工篩選，並依目前的客戶+個案重新載入員工清單(個案未選時只依客戶篩選)。
  useEffect(() => {
    setFilterEmployeeId(undefined)
    setFilterEmployees([])
    if (!listCompanyId) return
    apiClient
      .get<LogPage<EmployeeListItem>>('/admin/employees', {
        params: { companyId: listCompanyId, dispatchCaseId: filterDispatchCaseId, size: 500 },
      })
      .then((res) => setFilterEmployees(res.data.content))
      .catch(() => setFilterEmployees([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listCompanyId, filterDispatchCaseId])

  const applyFilters = () => {
    setPage(0)
    fetchNotifications(0)
  }

  const clearFilters = () => {
    setFilterDispatchCaseId(undefined)
    setFilterEmployeeId(undefined)
    setFilterSender('')
    setFilterSubject('')
    setFilterContent('')
    setFilterSentRange(null)
    setFilterReadRange(null)
    setPage(0)
    fetchNotifications(0, {
      dispatchCaseId: undefined,
      employeeId: undefined,
      sender: '',
      subject: '',
      content: '',
      sentRange: null,
      readRange: null,
    })
  }

  // 發送對象：選擇客戶改變時，重置底下兩層回「全部」，並重新載入派遣個案清單。
  useEffect(() => {
    setDispatchCaseId(ALL)
    setDispatchCases([])
    setEmployeeId(ALL)
    setEmployees([])
    if (companyId === ALL) return
    apiClient
      .get<DispatchCaseItem[]>(`/admin/companies/${companyId}/dispatch-cases`)
      .then((res) => setDispatchCases(res.data))
      .catch(() => setDispatchCases([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  // 選擇派遣個案改變時，重置員工回「全部」，並依目前的客戶+個案重新載入員工清單(個案=全部時
  // 只依客戶篩選，讓使用者可以直接跳過個案、從整家客戶底下挑一位員工)。
  useEffect(() => {
    setEmployeeId(ALL)
    setEmployees([])
    if (companyId === ALL) return
    apiClient
      .get<LogPage<EmployeeListItem>>('/admin/employees', {
        params: {
          companyId,
          dispatchCaseId: dispatchCaseId === ALL ? undefined : dispatchCaseId,
          size: 500,
        },
      })
      .then((res) => setEmployees(res.data.content))
      .catch(() => setEmployees([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, dispatchCaseId])

  const openCompose = () => {
    setCompanyId(ALL)
    setDispatchCaseId(ALL)
    setEmployeeId(ALL)
    form.resetFields()
    setComposeOpen(true)
  }

  const submitBroadcast = async () => {
    try {
      const values = await form.validateFields()
      setSending(true)
      const body: BroadcastNotificationRequest = {
        companyId: companyId === ALL ? undefined : companyId,
        dispatchCaseId: dispatchCaseId === ALL ? undefined : dispatchCaseId,
        employeeId: employeeId === ALL ? undefined : employeeId,
        subject: values.subject,
        content: values.content,
      }
      const res = await apiClient.post<string>('/admin/notifications', body)
      message.success(res.data ?? '已發送')
      setComposeOpen(false)
      form.resetFields()
      if (body.companyId === undefined || body.companyId === listCompanyId) {
        setPage(0)
        fetchNotifications(0)
      }
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        return
      }
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? '發送失敗')
    } finally {
      setSending(false)
    }
  }

  const columns: ColumnsType<AdminNotificationItem> = [
    {
      title: '序號',
      key: 'seq',
      width: 60,
      render: (_, __, index) => page * pageSize + index + 1,
    },
    {
      title: '客戶',
      dataIndex: 'companyName',
      key: 'companyName',
      width: 140,
      sorter: (a, b) => compareStrings(a.companyName, b.companyName),
    },
    {
      title: '個案',
      dataIndex: 'dispatchCaseCode',
      key: 'dispatchCaseCode',
      width: 120,
      render: (v: string | null) => v ?? '全部',
      sorter: (a, b) => compareStrings(a.dispatchCaseCode, b.dispatchCaseCode),
    },
    {
      title: '員工',
      key: 'recipient',
      width: 160,
      render: (_, record) =>
        record.recipientEmployeeNum ? `${record.recipientEmployeeNum} ${record.recipientChname ?? ''}` : '全部',
      sorter: (a, b) => compareStrings(a.recipientEmployeeNum, b.recipientEmployeeNum),
    },
    { title: '主旨', dataIndex: 'subject', key: 'subject', sorter: (a, b) => compareStrings(a.subject, b.subject) },
    {
      title: '內容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      sorter: (a, b) => compareStrings(a.content, b.content),
    },
    {
      title: '發送人',
      dataIndex: 'senderName',
      key: 'senderName',
      width: 140,
      sorter: (a, b) => compareStrings(a.senderName, b.senderName),
    },
    {
      title: '發送時間',
      dataIndex: 'sentTime',
      key: 'sentTime',
      width: 160,
      sorter: (a, b) => compareDates(a.sentTime, b.sentTime),
    },
    {
      title: '已讀時間',
      dataIndex: 'readTime',
      key: 'readTime',
      width: 160,
      render: (v: string | null) => v ?? '未讀',
      sorter: (a, b) => compareDates(a.readTime, b.readTime),
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f6f8' }}>
      <PageHeader
        title="通知廣播"
        actions={
          <Button type="primary" onClick={openCompose}>
            發送通知
          </Button>
        }
      />
      <div style={{ padding: 24 }}>
        <Space style={{ marginBottom: 12 }} wrap>
          <span>選擇客戶：</span>
          <Select
            style={{ width: 360 }}
            placeholder="選擇客戶"
            value={listCompanyId}
            onChange={(v) => {
              setListCompanyId(v)
              setPage(0)
            }}
            options={sortCompaniesTemplateLast(listCompanies).map((c) => ({
              value: c.id,
              label: c.template ? `[樣板] ${c.companyNum} ${c.chName}` : `${c.companyNum} ${c.chName}`,
            }))}
          />
          <span>選擇個案：</span>
          <Select
            style={{ width: 200 }}
            placeholder="個案(全部)"
            allowClear
            value={filterDispatchCaseId}
            onChange={setFilterDispatchCaseId}
            options={filterDispatchCases.map((d) => ({ value: d.id, label: d.caseCode }))}
          />
          <span>選擇員工：</span>
          <Select
            style={{ width: 220 }}
            placeholder="員工(全部)"
            allowClear
            value={filterEmployeeId}
            onChange={setFilterEmployeeId}
            options={filterEmployees.map((e) => ({ value: e.id, label: `${e.employeenum} ${e.chname}` }))}
          />
        </Space>
        <Space style={{ marginBottom: 12 }} wrap>
          <Input
            style={{ width: 160 }}
            placeholder="發送人"
            allowClear
            value={filterSender}
            onChange={(e) => setFilterSender(e.target.value)}
          />
          <Input
            style={{ width: 160 }}
            placeholder="主旨關鍵字"
            allowClear
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
          />
          <Input
            style={{ width: 160 }}
            placeholder="內容關鍵字"
            allowClear
            value={filterContent}
            onChange={(e) => setFilterContent(e.target.value)}
          />
          <span>發送時間：</span>
          <DatePicker.RangePicker
            format="YYYY/MM/DD"
            value={filterSentRange}
            onChange={(dates) => setFilterSentRange(dates as [Dayjs, Dayjs] | null)}
          />
          <span>已讀時間：</span>
          <DatePicker.RangePicker
            format="YYYY/MM/DD"
            value={filterReadRange}
            onChange={(dates) => setFilterReadRange(dates as [Dayjs, Dayjs] | null)}
          />
          <Button type="primary" onClick={applyFilters}>
            查詢
          </Button>
          <Button onClick={clearFilters}>清除</Button>
        </Space>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <Space>
            <ResultCount count={data?.totalElements} />
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
          dataSource={data?.content ?? []}
          pagination={{
            current: page + 1,
            pageSize,
            total: data?.totalElements ?? 0,
            showSizeChanger: false,
            onChange: (nextPage) => setPage(nextPage - 1),
          }}
        />
      </div>
      <Modal
        title="發送通知"
        open={composeOpen}
        onCancel={() => setComposeOpen(false)}
        onOk={submitBroadcast}
        confirmLoading={sending}
        destroyOnHidden
        width={560}
      >
        <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
          <Space>
            <span style={{ display: 'inline-block', width: 90 }}>選擇客戶：</span>
            <Select
              style={{ width: 360 }}
              value={companyId}
              onChange={setCompanyId}
              options={[
                { value: ALL, label: '全部客戶' },
                ...sortCompaniesTemplateLast(companies).map((c) => ({
                  value: c.id,
                  label: c.template ? `[樣板] ${c.companyNum} ${c.chName}` : `${c.companyNum} ${c.chName}`,
                })),
              ]}
            />
          </Space>
          <Space>
            <span style={{ display: 'inline-block', width: 90 }}>選擇個案：</span>
            <Select
              style={{ width: 280 }}
              value={dispatchCaseId}
              onChange={setDispatchCaseId}
              disabled={companyId === ALL}
              options={[
                { value: ALL, label: '全部個案' },
                ...dispatchCases.map((d) => ({ value: d.id, label: d.caseCode })),
              ]}
            />
          </Space>
          <Space>
            <span style={{ display: 'inline-block', width: 90 }}>選擇員工：</span>
            <Select
              style={{ width: 280 }}
              value={employeeId}
              onChange={setEmployeeId}
              disabled={companyId === ALL}
              options={[
                { value: ALL, label: '全部員工' },
                ...employees.map((e) => ({ value: e.id, label: `${e.employeenum} ${e.chname}` })),
              ]}
            />
          </Space>
        </Space>
        <Form form={form} layout="vertical">
          <Form.Item name="subject" label="主旨" rules={[{ required: true, message: '請輸入主旨' }]}>
            <Input placeholder="主旨" />
          </Form.Item>
          <Form.Item name="content" label="內容" rules={[{ required: true, message: '請輸入內容' }]}>
            <Input.TextArea placeholder="內容" rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  )
}
