import type React from 'react'
import { Navigate, Route, BrowserRouter, Routes, useLocation } from 'react-router-dom'
import Login from './pages/Login'
import ChangePassword from './pages/ChangePassword'
import Home from './pages/Home'
import ManagerList from './pages/ManagerList'
import ManagerForm from './pages/ManagerForm'
import RoleRightsMatrix from './pages/RoleRightsMatrix'
import OperationLogList from './pages/OperationLogList'
import LoginLogList from './pages/LoginLogList'
import NotificationBroadcast from './pages/NotificationBroadcast'
import CompanyList from './pages/CompanyList'
import CompanyForm from './pages/CompanyForm'
import CompanyLeaveTypeList from './pages/CompanyLeaveTypeList'
import EmployeeLeaveTypeList from './pages/EmployeeLeaveTypeList'
import DepartmentList from './pages/DepartmentList'
import EmployeeList from './pages/EmployeeList'
import EmployeeForm from './pages/EmployeeForm'
import EmpDayCardList from './pages/EmpDayCardList'
import AttendanceDetailReport from './pages/AttendanceDetailReport'
import LeaveTypeList from './pages/LeaveTypeList'
import WorkOvertimeList from './pages/WorkOvertimeList'
import ComTimeScheduleList from './pages/ComTimeScheduleList'
import EmpScheduleCalendar from './pages/EmpScheduleCalendar'
import BatchImport from './pages/BatchImport'
import { useIdleLogout } from './hooks/useIdleLogout'

// 要跟後端 app.jwt.expiration-ms 保持一致
const IDLE_TIMEOUT_MS = 10 * 60 * 1000

function RequireAuth({ children }: { children: React.ReactElement }) {
  const token = localStorage.getItem('platformToken')
  const location = useLocation()
  useIdleLogout(IDLE_TIMEOUT_MS, !!token)
  if (!token) {
    return <Navigate to="/login" replace />
  }
  // 首次登入(密碼=帳號)強制先改密碼，改密碼前不能進其他任何頁面
  const mustChangePassword = localStorage.getItem('platformMustChangePassword') === 'true'
  if (mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }
  return children
}

export default function App() {
  return (
    // basename跟著vite.config.ts的base走：本機dev是"/"，正式打包是"/ImcCardPlatformAdmin/"，
    // 部署在非根路徑時React Router才能正確比對目前網址對應到哪個路由(不然/employees這種路由
    // 在/ImcCardPlatformAdmin/employees底下永遠比對不到)。
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/change-password"
          element={
            <RequireAuth>
              <ChangePassword />
            </RequireAuth>
          }
        />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Home />
            </RequireAuth>
          }
        />
        <Route
          path="/managers"
          element={
            <RequireAuth>
              <ManagerList />
            </RequireAuth>
          }
        />
        <Route
          path="/managers/new"
          element={
            <RequireAuth>
              <ManagerForm />
            </RequireAuth>
          }
        />
        <Route
          path="/managers/:id"
          element={
            <RequireAuth>
              <ManagerForm />
            </RequireAuth>
          }
        />
        <Route
          path="/role-rights"
          element={
            <RequireAuth>
              <RoleRightsMatrix />
            </RequireAuth>
          }
        />
        <Route
          path="/operation-logs"
          element={
            <RequireAuth>
              <OperationLogList />
            </RequireAuth>
          }
        />
        <Route
          path="/login-logs"
          element={
            <RequireAuth>
              <LoginLogList />
            </RequireAuth>
          }
        />
        <Route
          path="/notifications"
          element={
            <RequireAuth>
              <NotificationBroadcast />
            </RequireAuth>
          }
        />
        <Route
          path="/companies"
          element={
            <RequireAuth>
              <CompanyList />
            </RequireAuth>
          }
        />
        <Route
          path="/companies/new"
          element={
            <RequireAuth>
              <CompanyForm />
            </RequireAuth>
          }
        />
        <Route
          path="/companies/:id"
          element={
            <RequireAuth>
              <CompanyForm />
            </RequireAuth>
          }
        />
        <Route
          path="/company-leave-types"
          element={
            <RequireAuth>
              <CompanyLeaveTypeList />
            </RequireAuth>
          }
        />
        <Route
          path="/employee-leave-types"
          element={
            <RequireAuth>
              <EmployeeLeaveTypeList />
            </RequireAuth>
          }
        />
        <Route
          path="/departments"
          element={
            <RequireAuth>
              <DepartmentList />
            </RequireAuth>
          }
        />
        <Route
          path="/employees"
          element={
            <RequireAuth>
              <EmployeeList />
            </RequireAuth>
          }
        />
        <Route
          path="/employees/new"
          element={
            <RequireAuth>
              <EmployeeForm />
            </RequireAuth>
          }
        />
        <Route
          path="/employees/:id"
          element={
            <RequireAuth>
              <EmployeeForm />
            </RequireAuth>
          }
        />
        <Route
          path="/emp-day-cards"
          element={
            <RequireAuth>
              <EmpDayCardList />
            </RequireAuth>
          }
        />
        <Route
          path="/attendance-detail-report"
          element={
            <RequireAuth>
              <AttendanceDetailReport />
            </RequireAuth>
          }
        />
        <Route
          path="/leave-types"
          element={
            <RequireAuth>
              <LeaveTypeList />
            </RequireAuth>
          }
        />
        <Route
          path="/work-overtimes"
          element={
            <RequireAuth>
              <WorkOvertimeList />
            </RequireAuth>
          }
        />
        <Route
          path="/time-schedules"
          element={
            <RequireAuth>
              <ComTimeScheduleList />
            </RequireAuth>
          }
        />
        <Route
          path="/emp-schedule-calendar"
          element={
            <RequireAuth>
              <EmpScheduleCalendar />
            </RequireAuth>
          }
        />
        <Route
          path="/batch-import"
          element={
            <RequireAuth>
              <BatchImport />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
