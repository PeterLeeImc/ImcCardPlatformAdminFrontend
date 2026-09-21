import type { EmpDayOvertimeRow } from '../types'
import EmpDayApplicationList from './EmpDayApplicationList'

export default function EmpDayOvertimeList() {
  return (
    <EmpDayApplicationList
      title="員工每日加班"
      endpoint="emp-day-overtimes"
      typeColumnTitle="加班別"
      getTypeName={(row) => (row as EmpDayOvertimeRow).overtimeTypeName}
    />
  )
}
