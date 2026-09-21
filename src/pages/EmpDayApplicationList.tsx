import { useState } from 'react'
import { Button, InputNumber, Layout, Select, Space, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { apiClient } from '../api/client'
import type { EmpDayLeaveRow, EmpDayOvertimeRow } from '../types'
import { compareDates, compareNumbers, compareStrings } from '../utils/tableSort'
import { useCompanyCaseEmployee } from '../hooks/useCompanyCaseEmployee'
import PageHeader from '../components/PageHeader'
import ResultCount from '../components/ResultCount'
import PageSizeSelect from '../components/PageSizeSelect'

const WHOLE_MONTH = 0
const today = new Date()

type Row = EmpDayLeaveRow | EmpDayOvertimeRow

const STATUS_COLOR: Record<string, string> = { '001': 'orange', '002': 'green', '003': 'red' }

/** 後端回傳"yyyy-MM-dd HH:mm"，顯示成"yyyy/MM/dd HH:mm"。 */
const formatDateTimeLabel = (v: string | null | undefined) => (v ? v.replace(/-/g, '/') : '-')

interface Props {
  title: string
  /** 後端路徑，例如 emp-day-leaves。 */
  endpoint: string
  /** 「假別」或「加班別」欄位標題。 */
  typeColumnTitle: string
  getTypeName: (row: Row) => string | null
}

/**
 * 「員工每日請假」「員工每日加班」共用的查詢畫面，篩選方式比照「員工每日打卡」：客戶必選，個案/員工
 * 選填，年月+日(全月/單日)。列出的是日期區間跟查詢區間有重疊的單子，不分簽核狀態。
 */
export default function EmpDayApplicationList({ title, endpoint, typeColumnTitle, getTypeName }: Props) {
  const { companyId, dispatchCaseId, employeeId, selects } = useCompanyCaseEmployee()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [day, setDay] = useState<number>(today.getDate())
  const [rows, setRows] = useState<Row[]>([])
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(false)

  const fetchRows = () => {
    if (!companyId) return
    setLoading(true)
    apiClient
      .get<Row[]>(`/admin/${endpoint}`, {
        params: { companyId, dispatchCaseId: dispatchCaseId ?? 0, employeeId, year, month, day },
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

  const columns: ColumnsType<Row> = [
    {
      title: '序號',
      key: 'seq',
      width: 60,
      render: (_, __, index) => page * pageSize + index + 1,
    },
    {
      title: '員工編號',
      dataIndex: 'employeeNum',
      key: 'employeeNum',
      render: (v: string, record) => (record.dispatchCaseCode ? `${record.dispatchCaseCode}/${v}` : v),
      sorter: (a, b) => compareStrings(a.employeeNum, b.employeeNum),
    },
    {
      title: '姓名',
      dataIndex: 'employeeChname',
      key: 'employeeChname',
      sorter: (a, b) => compareStrings(a.employeeChname, b.employeeChname),
    },
    {
      title: typeColumnTitle,
      key: 'typeName',
      render: (_, record) => getTypeName(record) ?? '-',
      sorter: (a, b) => compareStrings(getTypeName(a), getTypeName(b)),
    },
    {
      title: '開始時間',
      dataIndex: 'startDate',
      key: 'startDate',
      render: formatDateTimeLabel,
      sorter: (a, b) => compareDates(a.startDate, b.startDate),
    },
    {
      title: '結束時間',
      dataIndex: 'endDate',
      key: 'endDate',
      render: formatDateTimeLabel,
      sorter: (a, b) => compareDates(a.endDate, b.endDate),
    },
    {
      title: '時數',
      dataIndex: 'hours',
      key: 'hours',
      sorter: (a, b) => compareNumbers(a.hours, b.hours),
    },
    {
      title: '狀態',
      dataIndex: 'statusName',
      key: 'statusName',
      render: (v: string | null, record) =>
        v ? <Tag color={STATUS_COLOR[record.statusCode ?? ''] ?? 'default'}>{v}</Tag> : '-',
      sorter: (a, b) => compareStrings(a.statusCode, b.statusCode),
    },
    {
      title: '預設簽核人',
      dataIndex: 'defaultApprover',
      key: 'defaultApprover',
      render: (v: string | null) => v ?? '-',
      sorter: (a, b) => compareStrings(a.defaultApprover, b.defaultApprover),
    },
    {
      title: '實際簽核人',
      dataIndex: 'actualApprover',
      key: 'actualApprover',
      render: (v: string | null, record) => (
        <Space size={4}>
          {v ?? '-'}
          {record.delegateNote && <Tag color="purple">代理</Tag>}
        </Space>
      ),
      sorter: (a, b) => compareStrings(a.actualApprover, b.actualApprover),
    },
    {
      title: '事由',
      dataIndex: 'descr',
      key: 'descr',
      render: (v: string | null) => v ?? '',
    },
    {
      title: '簽核備註',
      dataIndex: 'explain',
      key: 'explain',
      render: (v: string | null) => v ?? '',
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f6f8' }}>
      <PageHeader title={title} />
      <div style={{ padding: 24 }}>
        <Space style={{ marginBottom: 16 }} wrap>
          {selects}
          <InputNumber value={year} onChange={(v) => setYear(v ?? today.getFullYear())} style={{ width: 100 }} addonAfter="年" />
          <InputNumber value={month} min={1} max={12} onChange={(v) => setMonth(v ?? 1)} style={{ width: 90 }} addonAfter="月" />
          <Select
            style={{ width: 120 }}
            value={day}
            onChange={setDay}
            options={[
              { value: WHOLE_MONTH, label: '全月' },
              ...Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: `${i + 1}日` })),
            ]}
          />
          <Button type="primary" onClick={fetchRows}>
            查詢
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
    </Layout>
  )
}
