import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, InputNumber, Layout, Modal, Select, Space, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { apiClient } from '../api/client'
import type { CompanyListItem, EmpDayCardRow, EmployeeListItem, LogPage } from '../types'

const ALL_EMPLOYEES = 0
const WHOLE_MONTH = 0
const today = new Date()

export default function EmpDayCardList() {
  const navigate = useNavigate()
  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [companyId, setCompanyId] = useState<number>()
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
      .catch(() => message.error('載入公司清單失敗'))
  }, [])

  useEffect(() => {
    if (!companyId) return
    apiClient
      .get<LogPage<EmployeeListItem>>('/admin/employees', { params: { companyId, page: 0, size: 500 } })
      .then((res) => setEmployees(res.data.content))
      .catch(() => setEmployees([]))
  }, [companyId])

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
    { title: '員工編號', dataIndex: 'employeeNum', key: 'employeeNum' },
    { title: '姓名', dataIndex: 'employeeChname', key: 'employeeChname' },
    { title: '日期', dataIndex: 'rowDate', key: 'rowDate' },
    { title: '班別', dataIndex: 'workTypeLabel', key: 'workTypeLabel' },
    { title: '班表時段', dataIndex: 'scheduleTimeLabel', key: 'scheduleTimeLabel' },
    {
      title: '狀態',
      dataIndex: 'punchedLabel',
      key: 'punchedLabel',
      render: (v: string, record) => <Tag color={record.punched ? 'blue' : 'red'}>{v}</Tag>,
    },
    { title: '上班打卡', dataIndex: 'startTimeLabel', key: 'startTimeLabel' },
    { title: '下班打卡', dataIndex: 'endTimeLabel', key: 'endTimeLabel' },
    { title: '有效工時', dataIndex: 'effectiveHoursLabel', key: 'effectiveHoursLabel' },
    {
      title: '定位',
      key: 'location',
      render: (_, record) =>
        record.locationValid == null ? '' : <Tag color={record.locationValid ? 'blue' : 'red'}>{record.locationValid ? '範圍內' : '超出範圍'}</Tag>,
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
          <Select
            style={{ width: 240 }}
            placeholder="選擇公司"
            value={companyId}
            onChange={setCompanyId}
            options={companies.map((c) => ({ value: c.id, label: `${c.companyNum} ${c.chName}` }))}
          />
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
