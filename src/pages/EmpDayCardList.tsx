import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, InputNumber, Layout, Modal, Select, Space, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { apiClient } from '../api/client'
import type { CompanyListItem, DispatchCaseItem, EmpDayCardRow, EmployeeListItem, LogPage } from '../types'
import { formatDate } from '../utils/formatDate'
import { compareDates, compareNumericLabels, compareStrings } from '../utils/tableSort'

const ALL_EMPLOYEES = 0
const WHOLE_MONTH = 0
const today = new Date()

export default function EmpDayCardList() {
  const navigate = useNavigate()
  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [companyId, setCompanyId] = useState<number>()
  const [dispatchCases, setDispatchCases] = useState<DispatchCaseItem[]>([])
  const [dispatchCaseId, setDispatchCaseId] = useState<number>()
  const [employees, setEmployees] = useState<EmployeeListItem[]>([])
  const [employeeId, setEmployeeId] = useState<number>(ALL_EMPLOYEES)
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [day, setDay] = useState<number>(today.getDate())
  const [rows, setRows] = useState<EmpDayCardRow[]>([])
  const [loading, setLoading] = useState(false)
  const [photoModal, setPhotoModal] = useState<{ title: string; url: string }>()

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

  // 選擇客戶改變時，重置個案/員工，並重新載入這家客戶的派遣個案清單。
  useEffect(() => {
    setDispatchCaseId(undefined)
    setDispatchCases([])
    setEmployeeId(ALL_EMPLOYEES)
    if (!companyId) return
    apiClient
      .get<DispatchCaseItem[]>(`/admin/companies/${companyId}/dispatch-cases`)
      .then((res) => setDispatchCases(res.data))
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
    if (employeeId === ALL_EMPLOYEES && day === WHOLE_MONTH) {
      message.warning('「全部員工」不能搭配「全月」查詢，請指定單一員工或選擇單一日期')
      return
    }
    setLoading(true)
    apiClient
      .get<EmpDayCardRow[]>('/admin/emp-day-cards', {
        params: { companyId, employeeId, year, month, day },
      })
      .then((res) => setRows(res.data))
      .catch((err) => {
        const axiosErr = err as { response?: { data?: string } }
        message.error(axiosErr.response?.data ?? '查詢失敗')
      })
      .finally(() => setLoading(false))
  }

  const viewPhoto = async (cardId: number, type: 'start' | 'end', title: string) => {
    try {
      const res = await apiClient.get(`/admin/emp-day-cards/${cardId}/photo/${type}`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data as Blob)
      setPhotoModal({ title, url })
    } catch {
      message.error('載入照片失敗')
    }
  }

  const closePhotoModal = () => {
    if (photoModal) {
      URL.revokeObjectURL(photoModal.url)
    }
    setPhotoModal(undefined)
  }

  const columns: ColumnsType<EmpDayCardRow> = [
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
      title: '日期',
      dataIndex: 'rowDate',
      key: 'rowDate',
      render: formatDate,
      sorter: (a, b) => compareDates(a.rowDate, b.rowDate),
    },
    {
      title: '班別',
      dataIndex: 'workTypeLabel',
      key: 'workTypeLabel',
      sorter: (a, b) => compareStrings(a.workTypeLabel, b.workTypeLabel),
    },
    {
      title: '班表時段',
      dataIndex: 'scheduleTimeLabel',
      key: 'scheduleTimeLabel',
      sorter: (a, b) => compareStrings(a.scheduleTimeLabel, b.scheduleTimeLabel),
    },
    {
      title: '狀態',
      dataIndex: 'punchedLabel',
      key: 'punchedLabel',
      render: (v: string, record) => <Tag color={record.punched ? 'blue' : 'red'}>{v}</Tag>,
      sorter: (a, b) => compareStrings(a.punchedLabel, b.punchedLabel),
    },
    {
      title: '上班打卡',
      dataIndex: 'startTimeLabel',
      key: 'startTimeLabel',
      sorter: (a, b) => compareStrings(a.startTimeLabel, b.startTimeLabel),
    },
    {
      title: '下班打卡',
      dataIndex: 'endTimeLabel',
      key: 'endTimeLabel',
      sorter: (a, b) => compareStrings(a.endTimeLabel, b.endTimeLabel),
    },
    {
      title: '有效工時',
      dataIndex: 'effectiveHoursLabel',
      key: 'effectiveHoursLabel',
      sorter: (a, b) => compareNumericLabels(a.effectiveHoursLabel, b.effectiveHoursLabel),
    },
    {
      title: '定位',
      key: 'location',
      render: (_, record) =>
        record.locationValid == null ? '' : <Tag color={record.locationValid ? 'blue' : 'red'}>{record.locationValid ? '範圍內' : '超出範圍'}</Tag>,
      sorter: (a, b) => compareStrings(String(a.locationValid ?? ''), String(b.locationValid ?? '')),
    },
    {
      title: '照片',
      key: 'photo',
      render: (_, record) => (
        <Space>
          {record.hasStartPhoto && record.cardId && (
            <a onClick={() => viewPhoto(record.cardId as number, 'start', `${record.employeeChname} 上班照片`)}>上班照片</a>
          )}
          {record.hasEndPhoto && record.cardId && (
            <a onClick={() => viewPhoto(record.cardId as number, 'end', `${record.employeeChname} 下班照片`)}>下班照片</a>
          )}
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
          padding: '16px 24px',
          background: '#fff',
          borderBottom: '1px solid #eee',
        }}
      >
        <Space>
          <a onClick={() => navigate('/')}>首頁</a>
          <span style={{ fontSize: 18, fontWeight: 600 }}>員工每日打卡</span>
        </Space>
      </div>
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
        <Table rowKey={(r) => `${r.employeeId}-${r.rowDate}`} loading={loading} columns={columns} dataSource={rows} pagination={false} />
      </div>
      <Modal title={photoModal?.title} open={!!photoModal} onCancel={closePhotoModal} footer={null}>
        {photoModal && <img src={photoModal.url} alt={photoModal.title} style={{ width: '100%' }} />}
      </Modal>
    </Layout>
  )
}
