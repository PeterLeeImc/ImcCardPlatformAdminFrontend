import { useEffect, useState } from 'react'
import { Button, InputNumber, Layout, Select, Space, Table, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { apiClient, resolveDefaultCompanyId, resolveOperatingDispatchCaseIdOnly, sortCompaniesTemplateLast } from '../api/client'
import type { AttendanceReportRow, CompanyListItem, DispatchCaseItem, EmployeeListItem, LogPage } from '../types'
import { formatDate } from '../utils/formatDate'
import { compareDates, compareNumericLabels, compareStrings } from '../utils/tableSort'
import PageHeader from '../components/PageHeader'
import ResultCount from '../components/ResultCount'
import PageSizeSelect from '../components/PageSizeSelect'
import ApproxLocationLink from '../components/ApproxLocationLink'

const ALL_EMPLOYEES = 0
const today = new Date()

export default function AttendanceDetailReport() {
  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [companyId, setCompanyId] = useState<number>()
  const [dispatchCases, setDispatchCases] = useState<DispatchCaseItem[]>([])
  const [dispatchCaseId, setDispatchCaseId] = useState<number>()
  const [employees, setEmployees] = useState<EmployeeListItem[]>([])
  const [employeeId, setEmployeeId] = useState<number>(ALL_EMPLOYEES)
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [rows, setRows] = useState<AttendanceReportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    apiClient
      .get<LogPage<CompanyListItem>>('/admin/companies', { params: { page: 0, size: 200 } })
      .then((res) => {
        setCompanies(res.data.content)
        const defaultCompanyId = resolveDefaultCompanyId(res.data.content)
        if (defaultCompanyId) {
          setCompanyId(defaultCompanyId)
        }
      })
      .catch(() => message.error('載入客戶清單失敗'))
  }, [])

  // 選擇客戶改變時，重置個案/員工，並重新載入這家客戶的派遣個案清單。
  useEffect(() => {
    setDispatchCaseId(undefined)
    setDispatchCases([])
    setEmployeeId(ALL_EMPLOYEES)
    if (!companyId) return
    apiClient
      .get<DispatchCaseItem[]>(`/admin/companies/${companyId}/dispatch-cases`)
      .then((res) => {
        setDispatchCases(res.data)
        setDispatchCaseId(resolveOperatingDispatchCaseIdOnly(res.data, companyId))
      })
      .catch(() => setDispatchCases([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  // 選擇個案改變時，重置員工，並依目前的客戶+個案重新載入員工清單(個案未選時只依客戶篩選)。
  useEffect(() => {
    setEmployeeId(ALL_EMPLOYEES)
    if (!companyId) return
    apiClient
      .get<LogPage<EmployeeListItem>>('/admin/employees', {
        params: { companyId, dispatchCaseId, page: 0, size: 500 },
      })
      .then((res) => setEmployees(res.data.content))
      .catch(() => setEmployees([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, dispatchCaseId])

  const fetchRows = () => {
    if (!companyId) return
    setLoading(true)
    apiClient
      .get<AttendanceReportRow[]>('/admin/attendance-detail-report', {
        params: {
          companyId,
          dispatchCaseId,
          employeeId: employeeId === ALL_EMPLOYEES ? undefined : employeeId,
          year,
          month,
        },
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

  const exportExcel = async () => {
    if (!companyId) return
    setExporting(true)
    try {
      const res = await apiClient.get('/admin/attendance-detail-report/export', {
        params: {
          companyId,
          dispatchCaseId,
          employeeId: employeeId === ALL_EMPLOYEES ? undefined : employeeId,
          year,
          month,
        },
        responseType: 'blob',
      })
      const disposition = res.headers['content-disposition'] as string | undefined
      const match = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/)
      const fileName = match ? decodeURIComponent(match[1]) : `出勤明細報表_${year}${String(month).padStart(2, '0')}.xlsx`
      const url = URL.createObjectURL(res.data as Blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      message.error('匯出失敗')
    } finally {
      setExporting(false)
    }
  }

  const columns: ColumnsType<AttendanceReportRow> = [
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
    { title: '姓名', dataIndex: 'chName', key: 'chName', sorter: (a, b) => compareStrings(a.chName, b.chName) },
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      render: formatDate,
      sorter: (a, b) => compareDates(a.date, b.date),
    },
    {
      title: '班別',
      dataIndex: 'workType',
      key: 'workType',
      sorter: (a, b) => compareStrings(a.workType, b.workType),
    },
    {
      title: '打卡開始',
      dataIndex: 'cardStart',
      key: 'cardStart',
      sorter: (a, b) => compareStrings(a.cardStart, b.cardStart),
    },
    {
      title: '打卡結束',
      dataIndex: 'cardEnd',
      key: 'cardEnd',
      sorter: (a, b) => compareStrings(a.cardEnd, b.cardEnd),
    },
    {
      title: '上班大約位置',
      key: 'startApproxLocation',
      render: (_, record) => <ApproxLocationLink latitude={record.startLatitude} longitude={record.startLongitude} />,
    },
    {
      title: '下班大約位置',
      key: 'endApproxLocation',
      render: (_, record) => <ApproxLocationLink latitude={record.endLatitude} longitude={record.endLongitude} />,
    },
    {
      title: '打卡時數',
      dataIndex: 'cardHours',
      key: 'cardHours',
      sorter: (a, b) => compareNumericLabels(a.cardHours, b.cardHours),
    },
    {
      title: '請假開始',
      dataIndex: 'leaveStart',
      key: 'leaveStart',
      sorter: (a, b) => compareStrings(a.leaveStart, b.leaveStart),
    },
    {
      title: '請假結束',
      dataIndex: 'leaveEnd',
      key: 'leaveEnd',
      sorter: (a, b) => compareStrings(a.leaveEnd, b.leaveEnd),
    },
    {
      title: '請假時數',
      dataIndex: 'leaveHours',
      key: 'leaveHours',
      sorter: (a, b) => compareNumericLabels(a.leaveHours, b.leaveHours),
    },
    {
      title: '請假附件',
      dataIndex: 'attachmentNames',
      key: 'attachmentNames',
      render: (names: string[]) => names.join('、'),
      sorter: (a, b) => compareStrings(a.attachmentNames.join('、'), b.attachmentNames.join('、')),
    },
    {
      title: '加班開始',
      dataIndex: 'overtimeStart',
      key: 'overtimeStart',
      sorter: (a, b) => compareStrings(a.overtimeStart, b.overtimeStart),
    },
    {
      title: '加班結束',
      dataIndex: 'overtimeEnd',
      key: 'overtimeEnd',
      sorter: (a, b) => compareStrings(a.overtimeEnd, b.overtimeEnd),
    },
    {
      title: '加班時數',
      dataIndex: 'overtimeHours',
      key: 'overtimeHours',
      sorter: (a, b) => compareNumericLabels(a.overtimeHours, b.overtimeHours),
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f6f8' }}>
      <PageHeader
        title="出勤明細報表"
        actions={
          <Button onClick={exportExcel} loading={exporting} disabled={!companyId}>
            匯出Excel
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
            options={sortCompaniesTemplateLast(companies).map((c) => ({
              value: c.id,
              label: c.template ? `[樣板] ${c.companyNum} ${c.chName}` : `${c.companyNum} ${c.chName}`,
            }))}
          />
          <span>選擇個案：</span>
          <Select
            style={{ width: 200 }}
            placeholder="個案(全部)"
            allowClear
            value={dispatchCaseId}
            onChange={setDispatchCaseId}
            options={dispatchCases.map((d) => ({ value: d.id, label: d.caseCode }))}
          />
          <span>選擇員工：</span>
          <Select
            style={{ width: 200 }}
            value={employeeId}
            onChange={setEmployeeId}
            options={[
              { value: ALL_EMPLOYEES, label: '全部員工' },
              ...employees.map((e) => ({ value: e.id, label: `${e.employeenum} ${e.chname}` })),
            ]}
            showSearch
            optionFilterProp="label"
          />
          <InputNumber value={year} onChange={(v) => setYear(v ?? today.getFullYear())} style={{ width: 100 }} addonAfter="年" />
          <InputNumber value={month} min={1} max={12} onChange={(v) => setMonth(v ?? 1)} style={{ width: 90 }} addonAfter="月" />
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
          rowKey={(r) => `${r.employeeNum}-${r.date}`}
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
          scroll={{ x: 'max-content' }}
        />
      </div>
    </Layout>
  )
}
