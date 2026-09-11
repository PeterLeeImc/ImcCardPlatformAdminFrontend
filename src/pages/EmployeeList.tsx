import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Input, Layout, Modal, Select, Space, Table, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { apiClient, isAdvisorRole } from '../api/client'
import type { CompanyListItem, DispatchCaseItem, EmployeeListItem, LogPage } from '../types'
import { JOB_STATUS_OPTIONS, SEX_OPTIONS } from '../types'
import { formatDate } from '../utils/formatDate'

const PAGE_SIZE = 20
const SEX_LABELS: Record<string, string> = Object.fromEntries(SEX_OPTIONS.map((o) => [o.value, o.label]))

export default function EmployeeList() {
  const navigate = useNavigate()
  // 客戶/個案篩選狀態直接以查詢字串為唯一資料來源(不再另外用useState保存)，
  // 這樣離開清單頁(例如去編輯某位員工)後按「取消」用瀏覽器上一頁返回時，
  // 網址上的篩選條件還在，清單重新掛載時才能還原成離開前的篩選狀態。
  const [searchParams, setSearchParams] = useSearchParams()
  const companyId = searchParams.get('companyId') ? Number(searchParams.get('companyId')) : undefined
  const dispatchCaseId = searchParams.get('dispatchCaseId') ? Number(searchParams.get('dispatchCaseId')) : undefined
  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [dispatchCases, setDispatchCases] = useState<DispatchCaseItem[]>([])
  const [employeenum, setEmployeenum] = useState('')
  const [chname, setChname] = useState('')
  const [jobStatus, setJobStatus] = useState<string>()
  const [data, setData] = useState<LogPage<EmployeeListItem>>()
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    apiClient
      .get<LogPage<CompanyListItem>>('/admin/companies', { params: { page: 0, size: 200 } })
      .then((res) => {
        setCompanies(res.data.content)
        if (companyId && res.data.content.some((c) => c.id === companyId)) {
          return
        }
        if (res.data.content.length > 0) {
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev)
              next.set('companyId', String(res.data.content[0].id))
              next.delete('dispatchCaseId')
              return next
            },
            { replace: true },
          )
        }
      })
      .catch(() => message.error('載入客戶清單失敗'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!companyId) return
    apiClient
      .get<DispatchCaseItem[]>(`/admin/companies/${companyId}/dispatch-cases`)
      .then((res) => {
        setDispatchCases(res.data)
        if (dispatchCaseId && !res.data.some((d) => d.id === dispatchCaseId)) {
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev)
              next.delete('dispatchCaseId')
              return next
            },
            { replace: true },
          )
        }
      })
      .catch(() => setDispatchCases([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

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
          dispatchCaseId,
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
  }, [companyId, dispatchCaseId, page])

  const onSearch = () => {
    setPage(0)
    fetchRows(0)
  }

  const changeCompany = (v: number | undefined) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (v) {
          next.set('companyId', String(v))
        } else {
          next.delete('companyId')
        }
        next.delete('dispatchCaseId')
        return next
      },
      { replace: true },
    )
    setPage(0)
  }

  const changeDispatchCase = (v: number | undefined) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (v) {
          next.set('dispatchCaseId', String(v))
        } else {
          next.delete('dispatchCaseId')
        }
        return next
      },
      { replace: true },
    )
    setPage(0)
  }

  const openResetPassword = (record: EmployeeListItem) => {
    Modal.confirm({
      title: '確定要重設密碼？',
      content: (
        <>
          員工編號：{record.employeenum}
          <br />
          預設密碼為員工編號，請使用者登入自行變更密碼。
        </>
      ),
      onOk: async () => {
        try {
          await apiClient.post(`/admin/employees/${record.id}/reset-password`)
          message.success('密碼已重設')
        } catch (err) {
          const axiosErr = err as { response?: { data?: string } }
          message.error(axiosErr.response?.data ?? '重設密碼失敗')
        }
      },
    })
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
    { title: '中文姓名', dataIndex: 'chname', key: 'chname' },
    { title: '角色', dataIndex: 'roleLabel', key: 'roleLabel' },
    { title: '在職狀態', dataIndex: 'jobStatusLabel', key: 'jobStatusLabel' },
    { title: '性別', dataIndex: 'sex', key: 'sex', render: (v: string | null) => (v ? SEX_LABELS[v] ?? v : '-') },
    { title: '手機', dataIndex: 'mobilePhone', key: 'mobilePhone', render: (v: string | null) => v ?? '-' },
    { title: '到職日', dataIndex: 'takeDate', key: 'takeDate', render: formatDate },
    { title: '離職日', dataIndex: 'leaveDate', key: 'leaveDate', render: formatDate },
    { title: '簽核人員工編號', dataIndex: 'chargeHeadNum', key: 'chargeHeadNum', render: (v: string | null) => v ?? '-' },
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
        <Button
          type="primary"
          onClick={() => {
            const params = new URLSearchParams()
            if (companyId) params.set('companyId', String(companyId))
            if (dispatchCaseId) params.set('dispatchCaseId', String(dispatchCaseId))
            navigate(`/employees/new?${params.toString()}`)
          }}
          disabled={!companyId || isAdvisorRole()}
        >
          新增員工
        </Button>
      </div>
      <div style={{ padding: 24 }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <span>選擇客戶：</span>
          <Select
            style={{ width: 240 }}
            placeholder="選擇客戶"
            value={companyId}
            onChange={changeCompany}
            options={companies.map((c) => ({ value: c.id, label: `${c.companyNum} ${c.chName}` }))}
          />
          <span>選擇個案：</span>
          <Select
            style={{ width: 200 }}
            placeholder="個案(全部)"
            allowClear
            value={dispatchCaseId}
            onChange={changeDispatchCase}
            options={dispatchCases.map((d) => ({ value: d.id, label: d.caseCode }))}
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
    </Layout>
  )
}
