import { useEffect, useState } from 'react'
import { Select, message } from 'antd'
import { apiClient, resolveDefaultCompanyId, resolveDefaultDispatchCaseId, sortCompaniesTemplateLast } from '../api/client'
import type { CompanyListItem, DispatchCaseItem, EmployeeListItem, LogPage } from '../types'

export const ALL_EMPLOYEES = 0

/**
 * 「客戶 → 個案 → 員工」三層篩選的共用狀態與下拉選單，行為跟「員工每日打卡」(EmpDayCardList)一致：
 * 預設帶目前操作的客戶/個案，換客戶時重置個案與員工，換個案時重置員工並重新載入員工清單(個案未選=整家客戶)。
 * 給「員工每日請假/加班」「簽核代理人維護」這幾個新頁面用。
 */
export function useCompanyCaseEmployee() {
  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [companyId, setCompanyId] = useState<number>()
  const [dispatchCases, setDispatchCases] = useState<DispatchCaseItem[]>([])
  const [dispatchCaseId, setDispatchCaseId] = useState<number>()
  const [employees, setEmployees] = useState<EmployeeListItem[]>([])
  const [employeeId, setEmployeeId] = useState<number>(ALL_EMPLOYEES)

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
    setDispatchCaseId(undefined)
    setDispatchCases([])
    setEmployeeId(ALL_EMPLOYEES)
    if (!companyId) return
    apiClient
      .get<DispatchCaseItem[]>(`/admin/companies/${companyId}/dispatch-cases`)
      .then((res) => {
        setDispatchCases(res.data)
        setDispatchCaseId(resolveDefaultDispatchCaseId(res.data, companyId))
      })
      .catch(() => setDispatchCases([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  useEffect(() => {
    setEmployeeId(ALL_EMPLOYEES)
    setEmployees([])
    // 員工下拉只列「所選個案」裡的員工，不是整家客戶的員工：還沒選個案(含換客戶後個案清單尚在載入)時不查詢，
    // 避免用「未選個案=整家客戶」的查詢結果晚回來、蓋掉之後才回來的個案員工清單。
    if (!companyId || !dispatchCaseId) return
    let cancelled = false
    apiClient
      .get<LogPage<EmployeeListItem>>('/admin/employees', {
        params: { companyId, dispatchCaseId, page: 0, size: 500 },
      })
      .then((res) => {
        if (!cancelled) setEmployees(res.data.content)
      })
      .catch(() => {
        if (!cancelled) setEmployees([])
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, dispatchCaseId])

  const selects = (
    <>
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
    </>
  )

  return { companies, companyId, dispatchCaseId, employees, employeeId, setEmployeeId, selects }
}
