import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, InputNumber, Layout, Select, Space, Table, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { apiClient } from '../api/client'
import type { AttendanceReportRow, CompanyListItem, LogPage } from '../types'

const today = new Date()

export default function AttendanceDetailReport() {
  const navigate = useNavigate()
  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [companyId, setCompanyId] = useState<number>()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [rows, setRows] = useState<AttendanceReportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

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
      .get<AttendanceReportRow[]>('/admin/attendance-detail-report', { params: { companyId, year, month } })
      .then((res) => setRows(res.data))
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
        params: { companyId, year, month },
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
    { title: '員工編號', dataIndex: 'employeeNum', key: 'employeeNum' },
    { title: '姓名', dataIndex: 'chName', key: 'chName' },
    { title: '日期', dataIndex: 'date', key: 'date' },
    { title: '班別', dataIndex: 'workType', key: 'workType' },
    { title: '打卡開始', dataIndex: 'cardStart', key: 'cardStart' },
    { title: '打卡結束', dataIndex: 'cardEnd', key: 'cardEnd' },
    { title: '打卡時數', dataIndex: 'cardHours', key: 'cardHours' },
    { title: '請假開始', dataIndex: 'leaveStart', key: 'leaveStart' },
    { title: '請假結束', dataIndex: 'leaveEnd', key: 'leaveEnd' },
    { title: '請假時數', dataIndex: 'leaveHours', key: 'leaveHours' },
    {
      title: '請假附件',
      dataIndex: 'attachmentNames',
      key: 'attachmentNames',
      render: (names: string[]) => names.join('、'),
    },
    { title: '加班開始', dataIndex: 'overtimeStart', key: 'overtimeStart' },
    { title: '加班結束', dataIndex: 'overtimeEnd', key: 'overtimeEnd' },
    { title: '加班時數', dataIndex: 'overtimeHours', key: 'overtimeHours' },
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
          <span style={{ fontSize: 18, fontWeight: 600 }}>出勤明細報表</span>
        </Space>
        <Button onClick={exportExcel} loading={exporting} disabled={!companyId}>
          匯出Excel
        </Button>
      </div>
      <div style={{ padding: 24 }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            style={{ width: 240 }}
            placeholder="選擇公司"
            value={companyId}
            onChange={setCompanyId}
            options={companies.map((c) => ({ value: c.id, label: `${c.companyNum} ${c.chName}` }))}
          />
          <InputNumber value={year} onChange={(v) => setYear(v ?? today.getFullYear())} style={{ width: 100 }} addonAfter="年" />
          <InputNumber value={month} min={1} max={12} onChange={(v) => setMonth(v ?? 1)} style={{ width: 90 }} addonAfter="月" />
          <Button type="primary" onClick={fetchRows}>
            查詢
          </Button>
        </Space>
        <Table
          rowKey={(r) => `${r.employeeNum}-${r.date}`}
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={{ pageSize: 31 }}
          scroll={{ x: 'max-content' }}
        />
      </div>
    </Layout>
  )
}
