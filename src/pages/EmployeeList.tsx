import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Checkbox, Layout, Modal, Select, Space, Table, Tag, message } from 'antd'
import { DeleteOutlined, EditOutlined, KeyOutlined, UndoOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  apiClient,
  isAdvisorEditingTemplateCompany,
  isAdvisorRole,
  resolveDefaultCompanyId,
  resolveDefaultDispatchCaseId,
  sortCompaniesTemplateLast,
} from '../api/client'
import type { CompanyListItem, DispatchCaseItem, EmployeeListItem, LogPage } from '../types'
import { JOB_STATUS_OPTIONS, SEX_OPTIONS } from '../types'
import PageHeader from '../components/PageHeader'
import ActionIcon from '../components/ActionIcon'
import ResultCount from '../components/ResultCount'
import PageSizeSelect from '../components/PageSizeSelect'
import { formatDate } from '../utils/formatDate'
import { imcEmployeeDetailUrl } from '../utils/imcLinks'
import { compareDates, compareNumbers, compareStrings } from '../utils/tableSort'

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
  const [data, setData] = useState<LogPage<EmployeeListItem>>()
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(false)
  const [includeHidden, setIncludeHidden] = useState(false)
  const [jobStatus, setJobStatus] = useState('001')

  useEffect(() => {
    apiClient
      .get<LogPage<CompanyListItem>>('/admin/companies', { params: { page: 0, size: 200 } })
      .then((res) => {
        setCompanies(res.data.content)
        if (companyId && res.data.content.some((c) => c.id === companyId)) {
          return
        }
        const defaultCompanyId = resolveDefaultCompanyId(res.data.content)
        if (defaultCompanyId) {
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev)
              next.set('companyId', String(defaultCompanyId))
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
        if (dispatchCaseId && res.data.some((d) => d.id === dispatchCaseId)) {
          return
        }
        const defaultCaseId = resolveDefaultDispatchCaseId(res.data, companyId)
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            if (defaultCaseId) {
              next.set('dispatchCaseId', String(defaultCaseId))
            } else {
              next.delete('dispatchCaseId')
            }
            return next
          },
          { replace: true },
        )
      })
      .catch(() => setDispatchCases([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  const fetchRows = (targetPage: number) => {
    if (!companyId || !dispatchCaseId) {
      setData(undefined)
      return
    }
    setLoading(true)
    apiClient
      .get<LogPage<EmployeeListItem>>('/admin/employees', {
        params: {
          companyId,
          dispatchCaseId,
          jobStatus: jobStatus || undefined,
          includeHidden,
          page: targetPage,
          size: pageSize,
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
  }, [companyId, dispatchCaseId, jobStatus, includeHidden, page, pageSize])

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
      content: isAdvisorRole()
        ? `員工編號：${record.employeenum}，刪除後系統管理者/系統使用者可以還原。`
        : `員工編號：${record.employeenum}`,
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

  const handleRestore = (record: EmployeeListItem) => {
    Modal.confirm({
      title: '確定要還原此員工？',
      content: `員工編號：${record.employeenum}`,
      onOk: async () => {
        try {
          await apiClient.post(`/admin/employees/${record.id}/restore`)
          message.success('已還原')
          fetchRows(page)
        } catch (err) {
          const axiosErr = err as { response?: { data?: string } }
          message.error(axiosErr.response?.data ?? '還原失敗')
        }
      },
    })
  }

  const templateLocked = isAdvisorEditingTemplateCompany(companies, companyId)

  const columns: ColumnsType<EmployeeListItem> = [
    {
      title: '序號',
      key: 'seq',
      width: 60,
      render: (_, __, index) => page * pageSize + index + 1,
    },
    {
      title: '員工編號',
      dataIndex: 'employeenum',
      key: 'employeenum',
      render: (v: string, record) => (
        <>
          <a href={imcEmployeeDetailUrl(v)} target="_blank" rel="noreferrer">
            {v}
          </a>
          {record.hidden && (
            <Tag color="default" style={{ marginLeft: 8 }}>
              已隱藏
            </Tag>
          )}
        </>
      ),
      sorter: (a, b) => compareStrings(a.employeenum, b.employeenum),
    },
    {
      title: '員工姓名',
      dataIndex: 'chname',
      key: 'chname',
      sorter: (a, b) => compareStrings(a.chname, b.chname),
    },
    {
      title: '角色',
      dataIndex: 'roleLabel',
      key: 'roleLabel',
      sorter: (a, b) => compareStrings(a.roleLabel, b.roleLabel),
    },
    {
      title: '性別',
      dataIndex: 'sex',
      key: 'sex',
      render: (v: string | null) => (v ? SEX_LABELS[v] ?? v : '-'),
      sorter: (a, b) => compareStrings(a.sex, b.sex),
    },
    {
      title: '行動電話',
      dataIndex: 'mobilePhone',
      key: 'mobilePhone',
      render: (v: string | null) => v ?? '-',
      sorter: (a, b) => compareStrings(a.mobilePhone, b.mobilePhone),
    },
    {
      title: '工作職稱',
      dataIndex: 'jobTitle',
      key: 'jobTitle',
      render: (v: string | null) => v ?? '-',
      sorter: (a, b) => compareStrings(a.jobTitle, b.jobTitle),
    },
    {
      title: '到職日',
      dataIndex: 'takeDate',
      key: 'takeDate',
      render: formatDate,
      sorter: (a, b) => compareDates(a.takeDate, b.takeDate),
    },
    {
      title: '離職日',
      dataIndex: 'leaveDate',
      key: 'leaveDate',
      render: formatDate,
      sorter: (a, b) => compareDates(a.leaveDate, b.leaveDate),
    },
    {
      title: '簽核人員工編號',
      dataIndex: 'chargeHeadNum',
      key: 'chargeHeadNum',
      render: (v: string | null) => v ?? '-',
      sorter: (a, b) => compareStrings(a.chargeHeadNum, b.chargeHeadNum),
    },
    {
      title: '到職天數',
      dataIndex: 'takeDateDay',
      key: 'takeDateDay',
      render: (v: number | null) => v ?? '-',
      sorter: (a, b) => compareNumbers(a.takeDateDay, b.takeDateDay),
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
            <ActionIcon
              title="還原"
              icon={<UndoOutlined />}
              disabled={templateLocked}
              onClick={() => handleRestore(record)}
            />
          </Space>
        ) : (
          <Space size="small">
            <ActionIcon
              title="編輯"
              icon={<EditOutlined />}
              disabled={templateLocked}
              onClick={() => navigate(`/employees/${record.id}`)}
            />
            <ActionIcon
              title="刪除"
              icon={<DeleteOutlined />}
              danger
              disabled={templateLocked}
              onClick={() => handleDelete(record)}
            />
            <ActionIcon
              title="重設密碼"
              icon={<KeyOutlined />}
              disabled={templateLocked}
              onClick={() => openResetPassword(record)}
            />
          </Space>
        ),
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f6f8' }}>
      <PageHeader
        title="員工維護"
        actions={
          <Button
            type="primary"
            onClick={() => {
              const params = new URLSearchParams()
              if (companyId) params.set('companyId', String(companyId))
              if (dispatchCaseId) params.set('dispatchCaseId', String(dispatchCaseId))
              navigate(`/employees/new?${params.toString()}`)
            }}
            disabled={!companyId}
          >
            新增員工
          </Button>
        }
      />
      <div style={{ padding: 24 }}>
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 8, flexWrap: 'wrap' }}
        >
          <Space wrap>
            <span>選擇客戶：</span>
            <Select
              style={{ width: 360 }}
              placeholder="選擇客戶"
              value={companyId}
              onChange={changeCompany}
              options={sortCompaniesTemplateLast(companies).map((c) => ({
                value: c.id,
                label: c.template ? `[樣板] ${c.companyNum} ${c.chName}` : `${c.companyNum} ${c.chName}`,
              }))}
            />
            <span>選擇個案：</span>
            <Select
              style={{ width: 200 }}
              placeholder="選擇個案"
              value={dispatchCaseId}
              onChange={changeDispatchCase}
              options={dispatchCases.map((d) => ({ value: d.id, label: d.caseCode }))}
            />
            <span>在職狀態：</span>
            <Select
              style={{ width: 140 }}
              allowClear
              placeholder="全部"
              value={jobStatus || undefined}
              onChange={(v) => setJobStatus(v ?? '')}
              options={JOB_STATUS_OPTIONS}
            />
            {!isAdvisorRole() && (
              <Checkbox checked={includeHidden} onChange={(e) => setIncludeHidden(e.target.checked)}>
                顯示已隱藏項目
              </Checkbox>
            )}
          </Space>
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
    </Layout>
  )
}
