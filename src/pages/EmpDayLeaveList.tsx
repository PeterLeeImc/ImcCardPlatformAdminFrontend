import type { EmpDayLeaveRow } from '../types'
import EmpDayApplicationList from './EmpDayApplicationList'

export default function EmpDayLeaveList() {
  return (
    <EmpDayApplicationList
      title="員工每日請假"
      endpoint="emp-day-leaves"
      typeColumnTitle="假別"
      getTypeName={(row) => (row as EmpDayLeaveRow).leaveTypeName}
    />
  )
}
