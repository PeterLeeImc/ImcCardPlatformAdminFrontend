// 使用者維護 (managers)

export interface ManagerListItem {
  id: number
  account: string
  username: string
  email: string
  enabled: string
  role: string
  roleLabel: string
  /** 建立業務帳號時查詢IMC系統所用的業務代號，建立後永久唯讀；手動建立的帳號是null。 */
  salesSerial: string | null
}

export interface ManagerDetail extends ManagerListItem {
  lastUsedCompanyId: number | null
  lastUsedCompanyName: string | null
  createdAt: string | null
  createdBy: string | null
  updatedAt: string | null
  updatedBy: string | null
}

export interface ManagerPage {
  content: ManagerListItem[]
  page: number
  totalPages: number
  totalElements: number
}

export interface ManagerCreateRequest {
  account: string
  username: string
  password: string
  email: string
  enabled: string
  role: string
  salesSerial?: string
}

export interface ManagerUpdateRequest {
  username: string
  email: string
  enabled: string
  role: string
}

/** 新增業務帳號時，依業務代號查詢IMC系統的結果，見ManagerController.lookupSales()。 */
export interface SalesLookupResult {
  found: boolean
  serial: string
  account: string | null
  chName: string | null
  email: string | null
}

/** 新增客戶時，依客戶編號查詢IMC系統的結果，見CompanyController.lookupCustomer()。 */
export interface CustomerLookupResult {
  found: boolean
  serial: string
  chName: string | null
  abbrName: string | null
  addr: string | null
}

// 使用者(Manager帳號)的角色只能是系統管理者/系統使用者/顧問，一般員工/簽核員工是打卡RWD員工帳號
// 的角色(見EMPLOYEE_ROLE_OPTIONS)，兩邊角色代碼表雖然共用同一張roles資料表，但下拉選單各自
// 限定成使用情境對應的子集，不會互相混用。顧問跟系統使用者一樣受資料範圍限制(只能看到自己被指派為
// 負責使用者的派遣個案/客戶)，見CompanyController/DispatchCaseController的isCompanyInScope()。
export const MANAGER_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: '001', label: '系統管理者' },
  { value: '003', label: '系統使用者' },
  { value: '004', label: '顧問' },
]

// enabled是舊ZK系統遺留下來的字串型boolean-ish欄位，實際資料看過"1"/"002"等值，
// 無法逆推原始語意，這裡針對新後台畫面採用簡單的兩選項對應，屬合理簡化。
export const ENABLED_OPTIONS: { value: string; label: string }[] = [
  { value: '1', label: '啟用' },
  { value: '0', label: '停用' },
]

// 角色功能 (role-rights)

export interface RoleDto {
  id: number
  roleName: string
  roleCode: string
}

export interface RightDto {
  id: number
  rightName: string
}

export interface RoleRightsDto {
  roleId: number
  rightIds: number[]
}

// 操作記錄／登入紀錄 (logs)

export interface RwdOperationLogItem {
  employeenum: string
  chname: string
  function: string
  action: string
  operationTime: string
}

export interface RwdLoginLogItem {
  employeenum: string
  chname: string
  loginTime: string
  ip: string
}

export interface LogPage<T> {
  content: T[]
  page: number
  totalPages: number
  totalElements: number
}

// 通知 (notification broadcast)

export interface NotificationItem {
  id: number
  senderAccount: string
  senderName: string
  recipientAccount: string | null
  subject: string
  content: string
  sentTime: string
  read: boolean
}

export interface BroadcastNotificationRequest {
  subject: string
  content: string
}

// 客戶維護 (companies)

export interface CompanyListItem {
  id: number
  companyNum: string
  chName: string
  name4Short: string
}

export interface CompanyDetail {
  id: number
  companyNum: string
  chName: string
  name4Short: string
  addr: string | null
  latitude: number | null
  longitude: number | null
  punchMethod: string | null
  gpsRadiusMeters: number | null
  createdAt: string | null
  createdBy: string | null
  updatedAt: string | null
  updatedBy: string | null
}

export interface CompanyCreateRequest {
  companyNum: string
  chName: string
  name4Short: string
  addr?: string
  latitude?: number
  longitude?: number
  punchMethod?: string
  gpsRadiusMeters?: number
}

export type CompanyUpdateRequest = Omit<CompanyCreateRequest, 'companyNum'>

export const PUNCH_METHOD_OPTIONS = [
  { value: 'GPS', label: 'GPS打卡' },
  { value: 'PHOTO', label: '拍照打卡' },
]

// 客戶配假設定 / 員工配假設定

export interface WebLeaveTypeItem {
  id: number
  leaveTypeId: number
  leaveTypeName: string
  year: string
  startDate: string | null
  endDate: string | null
  setMode: string | null
  useTime: string | null
  defaultHours: number | null
  jobWorkDay: number | null
  annualEffectiveDate: string | null
  accumulatingLeaveType: string | null
  createdAt: string | null
  createdBy: string | null
  updatedAt: string | null
  updatedBy: string | null
}

export interface WebLeaveTypeUpdateRequest {
  startDate: string | null
  endDate: string | null
  setMode: string | null
  useTime: string | null
  defaultHours: number | null
  jobWorkDay: number | null
  annualEffectiveDate: string | null
  accumulatingLeaveType: string | null
}

export interface WebEmpLeaveTypeItem {
  id: number
  employeeId: number
  employeeNum: string
  employeeChname: string
  leaveTypeId: number
  leaveTypeName: string
  year: string
  startDate: string | null
  endDate: string | null
  availableHours: number | null
  remainingHours: number | null
  useHours: number | null
  descr: string | null
  createdAt: string | null
  createdBy: string | null
  updatedAt: string | null
  updatedBy: string | null
}

export interface WebEmpLeaveTypeUpdateRequest {
  startDate: string | null
  endDate: string | null
  availableHours: number
  remainingHours: number
  useHours: number
  descr: string | null
}

export const SET_MODE_OPTIONS = [
  { value: '001', label: '手動輸入' },
  { value: '002', label: '年資轉年假' },
  { value: '003', label: '加班轉補休' },
  { value: '004', label: '生理假' },
]

export const ANNUAL_EFFECTIVE_DATE_OPTIONS = [
  { value: '001', label: '無' },
  { value: '002', label: '每年到職日' },
  { value: '003', label: '每年第一天' },
]

// 派遣個案 / 員工維護

export interface DispatchCaseItem {
  id: number
  caseCode: string
  responsibleUserId: number | null
  responsibleUserName: string | null
  defaultOvertimeChangeToCompTime: boolean
  createdAt: string | null
  createdBy: string | null
  updatedAt: string | null
  updatedBy: string | null
}

export interface DispatchCaseUpsertRequest {
  caseCode: string
  responsibleUserId?: number | null
  defaultOvertimeChangeToCompTime: boolean
}

export interface ManagerOption {
  id: number
  account: string
  username: string
}

// 假別維護 (leave type master)

export interface LeaveTypeMasterItem {
  id: number
  chname: string
  enname: string | null
  leaveDefaultFiled: string | null
  leaveSexCondition: string | null
  attachFileHours: number | null
  createdAt: string | null
  createdBy: string | null
  updatedAt: string | null
  updatedBy: string | null
}

export interface LeaveTypeMasterUpsertRequest {
  chname: string
  enname?: string
  leaveDefaultFiled?: string
  leaveSexCondition?: string
  attachFileHours?: number
}

export const LEAVE_DEFAULT_FILED_OPTIONS = [
  { value: '001', label: '無特殊角色' },
  { value: '002', label: '年假' },
  { value: '003', label: '補休' },
  { value: '006', label: '生理假' },
]

export const LEAVE_SEX_CONDITION_OPTIONS = [
  { value: '001', label: '限男性' },
  { value: '002', label: '限女性' },
  { value: '003', label: '不限' },
]

// 加班別維護 (work overtime master)

export interface WorkOvertimeItem {
  id: number
  chName: string
  createdAt: string | null
  createdBy: string | null
  updatedAt: string | null
  updatedBy: string | null
}

export interface WorkOvertimeUpsertRequest {
  chName: string
}

// 班表內容 (company time schedule master)

export interface ComTimeScheduleItem {
  id: number
  workType: string
  onTime: string | null
  offTime: string | null
  noonBreakStartTime: string | null
  noonBreakEndTime: string | null
  useCustomLocation: boolean
  addr: string | null
  latitude: number | null
  longitude: number | null
  punchMethod: string | null
  gpsRadiusMeters: number | null
  createdAt: string | null
  createdBy: string | null
  updatedAt: string | null
  updatedBy: string | null
}

export interface ComTimeScheduleUpsertRequest {
  workType: string
  onTime?: string
  offTime?: string
  noonBreakStartTime?: string
  noonBreakEndTime?: string
  useCustomLocation: boolean
  addr?: string
  latitude?: number
  longitude?: number
  punchMethod?: string
  gpsRadiusMeters?: number
}

export interface EmployeeListItem {
  id: number
  employeenum: string
  chname: string
  role: string
  roleLabel: string
  jobStatus: string | null
  jobStatusLabel: string | null
  sex: string | null
  mobilePhone: string | null
  takeDate: string | null
  leaveDate: string | null
  chargeHeadNum: string | null
  dispatchCaseCode: string | null
}

export interface EmployeeDetail {
  id: number
  employeenum: string
  chname: string
  role: string
  companyId: number | null
  companyName: string | null
  dispatchCaseId: number | null
  dispatchCaseCode: string | null
  sex: string | null
  mobilePhone: string | null
  takeDate: string | null
  leaveDate: string | null
  jobStatus: string | null
  chargeHeadNum: string | null
  realChargeHeadNum: string | null
  createdAt: string | null
  createdBy: string | null
  updatedAt: string | null
  updatedBy: string | null
}

export interface EmployeeUpsertRequest {
  employeenum?: string
  companyId?: number
  dispatchCaseId?: number
  chname: string
  role: string
  sex?: string
  mobilePhone?: string
  takeDate?: string
  leaveDate?: string
  jobStatus?: string
  chargeHeadNum?: string
}

// 員工的角色只有一般員工/簽核員工兩種(系統管理者/系統使用者是Manager帳號的角色，跟員工分開)。
export const EMPLOYEE_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: '006', label: '一般員工' },
  { value: '009', label: '簽核員工' },
]

export const SEX_OPTIONS = [
  { value: '001', label: '男' },
  { value: '002', label: '女' },
]

export const JOB_STATUS_OPTIONS = [
  { value: '001', label: '在職' },
  { value: '002', label: '離職' },
  { value: '003', label: '留職停薪' },
]

// 假日檔維護 (holidays)

export interface HolidayItem {
  id: number
  day: string
  explain: string
  createdAt: string | null
  createdBy: string | null
  updatedAt: string | null
  updatedBy: string | null
}

export interface HolidayUpsertRequest {
  day: string
  explain: string
}

// 員工每日打卡

export interface EmpDayCardRow {
  employeeId: number
  employeeNum: string
  employeeChname: string
  rowDate: string
  cardId: number | null
  punched: boolean
  punchedLabel: string
  startTimeLabel: string
  endTimeLabel: string
  startLatitude: number | null
  startLongitude: number | null
  endLatitude: number | null
  endLongitude: number | null
  locationValid: boolean | null
  hasStartPhoto: boolean
  hasEndPhoto: boolean
  workTypeLabel: string
  scheduleTimeLabel: string
  noonBreakLabel: string
  effectiveHoursLabel: string
}

// 出勤明細報表

export interface AttendanceReportRow {
  employeeNum: string
  chName: string
  date: string
  workType: string
  cardStart: string
  cardEnd: string
  cardHours: string
  leaveStart: string
  leaveEnd: string
  leaveHours: string
  attachmentNames: string[]
  overtimeStart: string
  overtimeEnd: string
  overtimeHours: string
}
