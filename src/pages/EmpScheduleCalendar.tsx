import { useEffect, useState } from 'react'
import { Button, DatePicker, Input, Layout, Modal, Select, Space, Upload, message } from 'antd'
import { LeftOutlined, RightOutlined, UploadOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import {
  apiClient,
  resolveDefaultCompanyId,
  resolveDefaultDispatchCaseId,
  sortCompaniesTemplateLast,
} from '../api/client'
import type { CompanyListItem, DispatchCaseItem, LeaveTypeMasterItem, LogPage } from '../types'
import PageHeader from '../components/PageHeader'

const LEAVE_DEFAULT_FILED_OFFICIAL = '010' // 公假

interface AdminEmployeeOption {
  id: number
  employeenum: string
  chname: string
}

interface ScheduleDay {
  employeeId: number
  employeeNum: string
  employeeChname: string
  date: string
  comTimeScheduleId: number
  workType: string
  punched: boolean
  startTimeLabel: string | null
  endTimeLabel: string | null
  leaveTypeName: string | null
}

interface ShiftOption {
  id: number
  workType: string
  onTime: string | null
  offTime: string | null
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const ALL_EMPLOYEES = 0
const SCHEDULED_COLOR = '#1677ff'
const LEAVE_COLOR = '#d4b106'
const PUNCHED_COLOR = '#52c41a'
const MISSED_COLOR = '#ff4d4f'

function formatDate(d: Date | Dayjs) {
  const jd = dayjs(d as any)
  return jd.format('YYYY-MM-DD')
}

function addDays(d: Date, days: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + days)
  return r
}

export default function EmpScheduleCalendar() {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [companyId, setCompanyId] = useState<number>()
  const [dispatchCases, setDispatchCases] = useState<DispatchCaseItem[]>([])
  const [dispatchCaseId, setDispatchCaseId] = useState<number>()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [employees, setEmployees] = useState<AdminEmployeeOption[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number>(ALL_EMPLOYEES)
  const [days, setDays] = useState<ScheduleDay[]>([])
  const [shiftOptions, setShiftOptions] = useState<ShiftOption[]>([])
  const [loading, setLoading] = useState(false)

  // 調班
  const [editTarget, setEditTarget] = useState<ScheduleDay>()
  const [editDate, setEditDate] = useState<Dayjs>(dayjs())
  const [editShiftId, setEditShiftId] = useState<number>()
  const [saving, setSaving] = useState(false)

  // 快速排班
  const windowEnd = addDays(today, 29)
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickYear, setQuickYear] = useState(today.getFullYear())
  const [quickMonth, setQuickMonth] = useState(today.getMonth() + 1)
  const [quickEmployeeId, setQuickEmployeeId] = useState<number>()
  const [quickShiftId, setQuickShiftId] = useState<number>()
  const [quickDates, setQuickDates] = useState<Set<string>>(new Set())
  const [quickSaving, setQuickSaving] = useState(false)

  // 匯入
  const [importFile, setImportFile] = useState<File>()
  const [importing, setImporting] = useState(false)
  const [importErrors, setImportErrors] = useState<string[]>([])

  // 快速產生公假
  const [officialLeaveTypes, setOfficialLeaveTypes] = useState<LeaveTypeMasterItem[]>([])
  const [officialLeaveOpen, setOfficialLeaveOpen] = useState(false)
  const [officialLeaveEmployeeIds, setOfficialLeaveEmployeeIds] = useState<number[]>([])
  const [officialLeaveTypeId, setOfficialLeaveTypeId] = useState<number>()
  const [officialLeaveDates, setOfficialLeaveDates] = useState<Dayjs[]>([dayjs()])
  const [officialLeaveDescr, setOfficialLeaveDescr] = useState('')
  const [officialLeaveSaving, setOfficialLeaveSaving] = useState(false)

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

  useEffect(() => {
    if (!companyId) return
    apiClient
      .get<DispatchCaseItem[]>(`/admin/companies/${companyId}/dispatch-cases`)
      .then((res) => {
        setDispatchCases(res.data)
        setDispatchCaseId(resolveDefaultDispatchCaseId(res.data, companyId))
      })
      .catch(() => setDispatchCases([]))
  }, [companyId])

  // 切換客戶時，dispatchCaseId必須跟companyId在同一次render裡一起清空(而不是等上面那個effect
  // 非同步查完新客戶的個案清單後才清)，否則畫面會先用「新客戶ID+舊個案ID」這組不存在的組合，
  // 讓下面依賴[companyId, dispatchCaseId]的effect打一次API，導致後端404「找不到派遣個案」閃現。
  const changeCompany = (v: number | undefined) => {
    setCompanyId(v)
    setDispatchCaseId(undefined)
  }

  const basePath = () => `/admin/companies/${companyId}/dispatch-cases/${dispatchCaseId}/schedules`

  useEffect(() => {
    if (!companyId || !dispatchCaseId) {
      // 同load()的理由：沒有清空的話，切到沒個案時這三個下拉/清單會繼續顯示上一個個案的資料。
      setEmployees([])
      setShiftOptions([])
      setOfficialLeaveTypes([])
      return
    }
    apiClient
      .get<AdminEmployeeOption[]>(`${basePath()}/employees`)
      .then((res) => setEmployees(res.data))
      .catch(() => setEmployees([]))
    apiClient
      .get<ShiftOption[]>(`/admin/companies/${companyId}/dispatch-cases/${dispatchCaseId}/time-schedules`)
      .then((res) => setShiftOptions(res.data))
      .catch(() => setShiftOptions([]))
    apiClient
      .get<LeaveTypeMasterItem[]>('/admin/leave-types', { params: { dispatchCaseId } })
      .then((res) => setOfficialLeaveTypes(res.data.filter((lt) => lt.leaveDefaultFiled === LEAVE_DEFAULT_FILED_OFFICIAL)))
      .catch(() => setOfficialLeaveTypes([]))
    setSelectedEmployeeId(ALL_EMPLOYEES)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, dispatchCaseId])

  const load = () => {
    if (!companyId || !dispatchCaseId) {
      // 切換客戶/個案時，dispatchCaseId會先變成undefined一個render(見changeCompany()的說明)，
      // 這裡沒有清空days的話，畫面會繼續顯示上一個已選個案的排班資料，讓使用者誤以為現在看到的
      // 還是「這個」個案的班表。
      setDays([])
      return
    }
    setLoading(true)
    apiClient
      .get<ScheduleDay[]>(`${basePath()}/calendar`, {
        params: {
          year,
          month,
          employeeId: selectedEmployeeId === ALL_EMPLOYEES ? undefined : selectedEmployeeId,
        },
      })
      .then((res) => setDays(res.data))
      .catch((err) => {
        const axiosErr = err as { response?: { data?: string } }
        message.error(axiosErr.response?.data ?? '載入排班失敗')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, dispatchCaseId, year, month, selectedEmployeeId])

  const changeMonth = (diff: number) => {
    let m = month + diff
    let y = year
    if (m < 1) {
      m = 12
      y -= 1
    } else if (m > 12) {
      m = 1
      y += 1
    }
    setYear(y)
    setMonth(m)
  }

  const buildDayCells = (y: number, m: number) => {
    const firstDay = new Date(y, m - 1, 1)
    const daysInMonth = new Date(y, m, 0).getDate()
    const leadingBlanks = firstDay.getDay()
    const cells: { day: number | null; dateKey: string | null }[] = []
    for (let i = 0; i < leadingBlanks; i++) cells.push({ day: null, dateKey: null })
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, dateKey: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` })
    }
    return cells
  }

  const dayMap: Record<string, ScheduleDay[]> = {}
  days.forEach((d) => {
    ;(dayMap[d.date] ??= []).push(d)
  })

  const todayKey = formatDate(now)
  const cells = buildDayCells(year, month)

  const colorFor = (entry: ScheduleDay) => {
    if (entry.leaveTypeName) return LEAVE_COLOR
    if (entry.date >= todayKey) return SCHEDULED_COLOR
    return entry.punched ? PUNCHED_COLOR : MISSED_COLOR
  }

  const labelFor = (entry: ScheduleDay) =>
    selectedEmployeeId === ALL_EMPLOYEES ? `${entry.employeeChname}-${entry.workType}` : entry.workType

  const openEdit = (day: ScheduleDay) => {
    if (day.date < todayKey) {
      if (day.leaveTypeName) {
        message.info(`${day.employeeChname} ${day.date} 請假(${day.leaveTypeName})`)
      } else if (day.punched) {
        message.info(`${day.employeeChname} ${day.date} ${day.startTimeLabel ?? ''}~${day.endTimeLabel ?? ''}`)
      } else {
        message.info(`${day.employeeChname} ${day.date} 未打卡`)
      }
      return
    }
    setEditTarget(day)
    setEditDate(dayjs(day.date))
    setEditShiftId(day.comTimeScheduleId)
  }

  const submitReschedule = async (force: boolean) => {
    if (!editTarget || !editShiftId || !companyId || !dispatchCaseId) return
    setSaving(true)
    try {
      await apiClient.post(`${basePath()}/reschedule`, {
        employeeId: editTarget.employeeId,
        originalDate: editTarget.date,
        newDate: formatDate(editDate),
        comTimeScheduleId: editShiftId,
        forceOverwrite: force,
      })
      message.success('調班成功')
      setEditTarget(undefined)
      load()
    } catch (err) {
      const axiosErr = err as { response?: { status?: number; data?: unknown } }
      if (axiosErr.response?.status === 409) {
        const conflictWorkType = axiosErr.response.data as string
        Modal.confirm({
          title: '排班衝突',
          content: `${formatDate(editDate)} 已經排班(${conflictWorkType})，確定要覆蓋嗎？`,
          onOk: () => submitReschedule(true),
        })
      } else {
        message.error((axiosErr.response?.data as string) ?? '調班失敗')
      }
    } finally {
      setSaving(false)
    }
  }

  const downloadTemplate = async () => {
    if (!companyId || !dispatchCaseId) return
    try {
      const res = await apiClient.get(`${basePath()}/import-template`, {
        params: { year, month },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `emp_schedule_${year}${String(month).padStart(2, '0')}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      message.error('範本下載失敗')
    }
  }

  const runImport = async () => {
    if (!importFile || !companyId || !dispatchCaseId) return
    setImporting(true)
    setImportErrors([])
    try {
      const formData = new FormData()
      formData.append('file', importFile)
      const res = await apiClient.post(`${basePath()}/import`, formData, { params: { year, month } })
      const data = res.data as { successCount: number; errors: string[] }
      if (data.errors && data.errors.length > 0) {
        setImportErrors(data.errors)
      } else {
        message.success(`匯入成功，共 ${data.successCount} 筆`)
        setImportFile(undefined)
        load()
      }
    } catch (err) {
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? '匯入失敗')
    } finally {
      setImporting(false)
    }
  }

  // 快速排班
  const openQuickAssign = () => {
    setQuickYear(today.getFullYear())
    setQuickMonth(today.getMonth() + 1)
    setQuickEmployeeId(employees[0]?.id)
    setQuickShiftId(shiftOptions[0]?.id)
    setQuickDates(new Set())
    setQuickOpen(true)
  }

  const quickWindowEndKey = formatDate(windowEnd)
  const quickStartAtFirstMonth = quickYear === today.getFullYear() && quickMonth === today.getMonth() + 1
  const quickAtLastMonth = quickYear === windowEnd.getFullYear() && quickMonth === windowEnd.getMonth() + 1

  const changeQuickMonth = (diff: number) => {
    let m = quickMonth + diff
    let y = quickYear
    if (m < 1) {
      m = 12
      y -= 1
    } else if (m > 12) {
      m = 1
      y += 1
    }
    setQuickYear(y)
    setQuickMonth(m)
  }

  const toggleQuickDate = (dateKey: string) => {
    setQuickDates((prev) => {
      const next = new Set(prev)
      if (next.has(dateKey)) next.delete(dateKey)
      else next.add(dateKey)
      return next
    })
  }

  const quickCells = buildDayCells(quickYear, quickMonth)
  const quickTodayKey = formatDate(today)

  const submitQuickAssign = async (force: boolean) => {
    if (!quickEmployeeId || !quickShiftId || quickDates.size === 0 || !companyId || !dispatchCaseId) {
      message.error('請選擇員工、班別，並至少勾選一天')
      return
    }
    setQuickSaving(true)
    try {
      await apiClient.post(`${basePath()}/quick-assign`, {
        employeeId: quickEmployeeId,
        dates: Array.from(quickDates),
        comTimeScheduleId: quickShiftId,
        forceOverwrite: force,
      })
      message.success('快速排班成功')
      setQuickOpen(false)
      load()
    } catch (err) {
      const axiosErr = err as { response?: { status?: number; data?: unknown } }
      if (axiosErr.response?.status === 409) {
        const conflictCount = axiosErr.response.data as number
        Modal.confirm({
          title: '排班衝突',
          content: `已選${quickDates.size}天，其中${conflictCount}天已經有排班，確定要覆蓋嗎？`,
          onOk: () => submitQuickAssign(true),
        })
      } else {
        message.error((axiosErr.response?.data as string) ?? '快速排班失敗')
      }
    } finally {
      setQuickSaving(false)
    }
  }

  // 快速產生公假
  const openOfficialLeave = () => {
    setOfficialLeaveEmployeeIds([])
    setOfficialLeaveTypeId(officialLeaveTypes[0]?.id)
    setOfficialLeaveDates([dayjs()])
    setOfficialLeaveDescr('')
    setOfficialLeaveOpen(true)
  }

  const submitOfficialLeave = async () => {
    if (!officialLeaveTypeId || officialLeaveEmployeeIds.length === 0 || officialLeaveDates.length === 0) {
      message.error('請選擇員工、公假假別，並至少選擇一天')
      return
    }
    if (!companyId || !dispatchCaseId) return
    setOfficialLeaveSaving(true)
    try {
      const res = await apiClient.post<{ created: number }>(`${basePath()}/quick-official-leave`, {
        leaveTypeId: officialLeaveTypeId,
        employeeIds: officialLeaveEmployeeIds,
        dates: officialLeaveDates.map((d) => d.format('YYYY-MM-DD')),
        descr: officialLeaveDescr || undefined,
      })
      message.success(`已產生${res.data.created}筆公假紀錄，並自動核准`)
      setOfficialLeaveOpen(false)
      load()
    } catch (err) {
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? '產生公假失敗')
    } finally {
      setOfficialLeaveSaving(false)
    }
  }

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f6f8' }}>
      <PageHeader
        title="員工班段行事曆"
        actions={
          <Space>
            <Button onClick={openQuickAssign} disabled={!dispatchCaseId}>
              快速排班
            </Button>
            <Button onClick={openOfficialLeave} disabled={!dispatchCaseId || officialLeaveTypes.length === 0}>
              快速產生公假
            </Button>
          </Space>
        }
      />
      <div style={{ padding: 24 }}>
        <Space style={{ marginBottom: 16 }} wrap>
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
            onChange={setDispatchCaseId}
            options={dispatchCases.map((d) => ({ value: d.id, label: d.caseCode }))}
          />
          <Select
            style={{ width: 200 }}
            value={selectedEmployeeId}
            onChange={setSelectedEmployeeId}
            options={[
              { value: ALL_EMPLOYEES, label: '全部員工' },
              ...employees.map((e) => ({ value: e.id, label: `${e.employeenum} ${e.chname}` })),
            ]}
            showSearch
            optionFilterProp="label"
          />
        </Space>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 16 }}>
          <LeftOutlined onClick={() => changeMonth(-1)} style={{ cursor: 'pointer' }} />
          <span style={{ fontSize: 16, fontWeight: 600 }}>
            {year} 年 {month} 月
          </span>
          <RightOutlined onClick={() => changeMonth(1)} style={{ cursor: 'pointer' }} />
        </div>

        <div style={{ background: '#fff', borderRadius: 8, padding: 16, opacity: loading ? 0.6 : 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: 8 }}>
            {WEEKDAYS.map((w) => (
              <div key={w} style={{ fontSize: 12, color: '#999', padding: '4px 0' }}>
                {w}
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {cells.map((cell, idx) => {
              if (cell.day === null) return <div key={`blank_${idx}`} />
              const entries = cell.dateKey ? dayMap[cell.dateKey] ?? [] : []
              const isToday = cell.dateKey === todayKey
              return (
                <div
                  key={cell.dateKey}
                  style={{
                    minHeight: 76,
                    borderRadius: 6,
                    padding: '4px 4px',
                    background: isToday ? '#e6f4ff' : '#fafafa',
                    border: isToday ? '1px solid #1677ff' : '1px solid #f0f0f0',
                  }}
                >
                  <div style={{ fontSize: 12, color: isToday ? '#1677ff' : '#333' }}>{cell.day}</div>
                  {entries.map((entry) => (
                    <div
                      key={entry.employeeId}
                      onClick={() => openEdit(entry)}
                      style={{
                        marginTop: 2,
                        fontSize: 11,
                        color: '#fff',
                        background: colorFor(entry),
                        borderRadius: 4,
                        padding: '1px 4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                      }}
                    >
                      {labelFor(entry)}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
          {shiftOptions.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>
              班段時段：
              {shiftOptions.map((s, i) => (
                <span key={s.id}>
                  {i > 0 && '、'}
                  {s.workType}({s.onTime}~{s.offTime})
                </span>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: '#666', flexWrap: 'wrap' }}>
            <span>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: SCHEDULED_COLOR }} /> 已排班
            </span>
            <span>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: LEAVE_COLOR }} /> 請假
            </span>
            <span>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: PUNCHED_COLOR }} /> 已打卡
            </span>
            <span>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: MISSED_COLOR }} /> 未打卡
            </span>
          </div>
        </div>

        <div style={{ marginTop: 24, background: '#fff', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>批次匯入</div>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>
            下載範本(會回填這家客戶目前該月排班) → 編輯Excel → 選檔上傳 → 執行匯入
          </div>
          <Space wrap style={{ marginBottom: 12 }}>
            <Button onClick={downloadTemplate} disabled={!dispatchCaseId}>
              下載範本
            </Button>
            <Upload
              accept=".xlsx"
              maxCount={1}
              showUploadList={{ showRemoveIcon: true }}
              beforeUpload={(file) => {
                setImportFile(file)
                return false
              }}
              onRemove={() => setImportFile(undefined)}
            >
              <Button icon={<UploadOutlined />}>選擇檔案</Button>
            </Upload>
            <Button type="primary" loading={importing} disabled={!importFile} onClick={runImport}>
              執行匯入
            </Button>
          </Space>
          {importErrors.length > 0 && (
            <div style={{ background: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 13, color: '#ff4d4f', fontWeight: 600, marginBottom: 6 }}>
                匯入失敗，以下錯誤都修正後才能重新上傳(未寫入任何資料)：
              </div>
              {importErrors.map((e, i) => (
                <div key={i} style={{ fontSize: 12, color: '#ff4d4f' }}>
                  {e}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        title="調班"
        open={!!editTarget}
        onCancel={() => setEditTarget(undefined)}
        onOk={() => submitReschedule(false)}
        confirmLoading={saving}
        destroyOnHidden
      >
        {editTarget && (
          <div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>員工：{editTarget.employeeChname}</div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>目前排班：{editTarget.workType}</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>新日期</div>
              <DatePicker
                value={editDate}
                minDate={dayjs(today)}
                onChange={(d) => d && setEditDate(d)}
                style={{ width: '100%' }}
                format="YYYY/MM/DD"
              />
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>新班別</div>
              <Select
                style={{ width: '100%' }}
                value={editShiftId}
                onChange={setEditShiftId}
                options={shiftOptions.map((s) => ({ value: s.id, label: s.workType }))}
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="快速排班"
        open={quickOpen}
        onCancel={() => setQuickOpen(false)}
        onOk={() => submitQuickAssign(false)}
        confirmLoading={quickSaving}
        destroyOnHidden
        width={480}
      >
        <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>員工</div>
        <Select
          style={{ width: '100%', marginBottom: 12 }}
          value={quickEmployeeId}
          onChange={setQuickEmployeeId}
          options={employees.map((e) => ({ value: e.id, label: `${e.employeenum} ${e.chname}` }))}
          showSearch
          optionFilterProp="label"
        />
        <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>班別</div>
        <Select
          style={{ width: '100%', marginBottom: 12 }}
          value={quickShiftId}
          onChange={setQuickShiftId}
          options={shiftOptions.map((s) => ({ value: s.id, label: s.workType }))}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, margin: '8px 0' }}>
          <LeftOutlined
            onClick={() => !quickStartAtFirstMonth && changeQuickMonth(-1)}
            style={{ cursor: quickStartAtFirstMonth ? 'default' : 'pointer', opacity: quickStartAtFirstMonth ? 0.3 : 1 }}
          />
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            {quickYear} 年 {quickMonth} 月
          </span>
          <RightOutlined
            onClick={() => !quickAtLastMonth && changeQuickMonth(1)}
            style={{ cursor: quickAtLastMonth ? 'default' : 'pointer', opacity: quickAtLastMonth ? 0.3 : 1 }}
          />
        </div>
        <div style={{ fontSize: 12, color: '#999', textAlign: 'center', marginBottom: 8 }}>
          只能勾選今天起30天內的日期(含今天)
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: 4 }}>
          {WEEKDAYS.map((w) => (
            <div key={w} style={{ fontSize: 11, color: '#999' }}>
              {w}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
          {quickCells.map((cell, idx) => {
            if (cell.day === null || !cell.dateKey) return <div key={`qblank_${idx}`} />
            const inRange = cell.dateKey >= quickTodayKey && cell.dateKey <= quickWindowEndKey
            const selected = quickDates.has(cell.dateKey)
            return (
              <div
                key={cell.dateKey}
                onClick={() => inRange && toggleQuickDate(cell.dateKey as string)}
                style={{
                  minHeight: 32,
                  lineHeight: '32px',
                  borderRadius: 6,
                  textAlign: 'center',
                  fontSize: 13,
                  cursor: inRange ? 'pointer' : 'default',
                  color: inRange ? (selected ? '#fff' : '#333') : '#ccc',
                  background: selected ? '#1677ff' : '#f5f6f8',
                }}
              >
                {cell.day}
              </div>
            )
          })}
        </div>
        <div style={{ fontSize: 12, color: '#999' }}>已選 {quickDates.size} 天</div>
      </Modal>

      <Modal
        title="快速產生公假"
        open={officialLeaveOpen}
        onCancel={() => setOfficialLeaveOpen(false)}
        onOk={submitOfficialLeave}
        confirmLoading={officialLeaveSaving}
        destroyOnHidden
        width={480}
      >
        <div style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>
          產生後直接標記為系統核准(簽核者：系統)，會發通知給員工，不會再走主管簽核流程。
        </div>
        <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>選擇員工(可全部或某幾位)</div>
        <Select
          style={{ width: '100%', marginBottom: 12 }}
          mode="multiple"
          value={officialLeaveEmployeeIds}
          onChange={setOfficialLeaveEmployeeIds}
          options={employees.map((e) => ({ value: e.id, label: `${e.employeenum} ${e.chname}` }))}
          showSearch
          optionFilterProp="label"
          maxTagCount="responsive"
        />
        <Button
          size="small"
          style={{ marginBottom: 12 }}
          onClick={() =>
            setOfficialLeaveEmployeeIds(
              officialLeaveEmployeeIds.length === employees.length ? [] : employees.map((e) => e.id),
            )
          }
        >
          {officialLeaveEmployeeIds.length === employees.length ? '取消全選' : '全選'}
        </Button>
        <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>假別(角色代碼為公假)</div>
        <Select
          style={{ width: '100%', marginBottom: 12 }}
          value={officialLeaveTypeId}
          onChange={setOfficialLeaveTypeId}
          options={officialLeaveTypes.map((lt) => ({ value: lt.id, label: lt.chname }))}
        />
        <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>公假日期(可複選，預設今天)</div>
        <DatePicker
          multiple
          style={{ width: '100%', marginBottom: 12 }}
          format="YYYY/MM/DD"
          value={officialLeaveDates}
          onChange={(dates) => setOfficialLeaveDates((dates as Dayjs[] | null) ?? [])}
        />
        <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>事由(選填)</div>
        <Input.TextArea
          rows={2}
          value={officialLeaveDescr}
          onChange={(e) => setOfficialLeaveDescr(e.target.value)}
          placeholder="例如：出差、公務、教育訓練"
        />
      </Modal>
    </Layout>
  )
}
