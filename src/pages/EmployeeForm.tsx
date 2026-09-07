import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, DatePicker, Form, Input, Layout, Select, Space, Spin, message } from 'antd'
import dayjs from 'dayjs'
import { apiClient } from '../api/client'
import type { CompanyListItem, DispatchCaseItem, EmployeeDetail, EmployeeUpsertRequest, LogPage } from '../types'
import { EMPLOYEE_ROLE_OPTIONS, JOB_STATUS_OPTIONS, SEX_OPTIONS } from '../types'
import { formatDateTime } from '../utils/formatDateTime'

const DATE_FORMAT = 'YYYY/MM/DD'
const WIRE_DATE_FORMAT = 'YYYY-MM-DD'

interface EmployeeFormValues {
  employeenum: string
  companyId: number
  dispatchCaseId: number
  chname: string
  role: string
  sex: string
  mobilePhone: string
  takeDate: dayjs.Dayjs | null
  leaveDate: dayjs.Dayjs | null
  jobStatus: string
  chargeHeadNum: string
}

export default function EmployeeForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const isEdit = !!id
  const [form] = Form.useForm<EmployeeFormValues>()
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [detail, setDetail] = useState<EmployeeDetail>()
  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [newCompanyId, setNewCompanyId] = useState<number>()
  const [newDispatchCases, setNewDispatchCases] = useState<DispatchCaseItem[]>([])

  // 新增員工要先選客戶才知道有哪些派遣個案可選，這裡只在新增模式下載入客戶清單。
  useEffect(() => {
    if (isEdit) return
    apiClient
      .get<LogPage<CompanyListItem>>('/admin/companies', { params: { page: 0, size: 200 } })
      .then((res) => {
        setCompanies(res.data.content)
        const fromUrl = Number(searchParams.get('companyId'))
        const initialCompanyId = fromUrl && res.data.content.some((c) => c.id === fromUrl) ? fromUrl : undefined
        if (initialCompanyId) {
          setNewCompanyId(initialCompanyId)
          form.setFieldValue('companyId', initialCompanyId)
        }
      })
      .catch(() => message.error('載入客戶清單失敗'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit])

  useEffect(() => {
    if (isEdit || !newCompanyId) {
      setNewDispatchCases([])
      return
    }
    apiClient
      .get<DispatchCaseItem[]>(`/admin/companies/${newCompanyId}/dispatch-cases`)
      .then((res) => {
        setNewDispatchCases(res.data)
        const fromUrl = Number(searchParams.get('dispatchCaseId'))
        if (fromUrl && res.data.some((d) => d.id === fromUrl)) {
          form.setFieldValue('dispatchCaseId', fromUrl)
        }
      })
      .catch(() => setNewDispatchCases([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, newCompanyId])

  useEffect(() => {
    if (!isEdit) return
    setLoading(true)
    apiClient
      .get<EmployeeDetail>(`/admin/employees/${id}`)
      .then((res) => {
        setDetail(res.data)
        const d = res.data
        form.setFieldsValue({
          employeenum: d.employeenum,
          chname: d.chname,
          role: d.role,
          sex: d.sex ?? undefined,
          mobilePhone: d.mobilePhone ?? '',
          takeDate: d.takeDate ? dayjs(d.takeDate) : null,
          leaveDate: d.leaveDate ? dayjs(d.leaveDate) : null,
          jobStatus: d.jobStatus ?? undefined,
          chargeHeadNum: d.chargeHeadNum ?? '',
        })
      })
      .catch((err) => {
        const axiosErr = err as { response?: { data?: string } }
        message.error(axiosErr.response?.data ?? '載入員工資料失敗')
      })
      .finally(() => setLoading(false))
  }, [id, isEdit, form])

  /** 儲存/取消都要回員工維護清單，並直接帶著這位員工所屬的客戶／派遣個案查詢，而不是回到
   * 進入這個表單前清單頁剛好停在哪個篩選狀態(那個狀態可能跟這位員工完全無關)。 */
  const goToListFor = (companyId?: number, dispatchCaseId?: number) => {
    const params = new URLSearchParams()
    if (companyId) params.set('companyId', String(companyId))
    if (dispatchCaseId) params.set('dispatchCaseId', String(dispatchCaseId))
    navigate(`/employees?${params.toString()}`)
  }

  const onFinish = async (values: EmployeeFormValues) => {
    setSubmitting(true)
    try {
      const body: EmployeeUpsertRequest = {
        chname: values.chname,
        role: values.role,
        sex: values.sex,
        mobilePhone: values.mobilePhone || undefined,
        takeDate: values.takeDate ? values.takeDate.format(WIRE_DATE_FORMAT) : undefined,
        leaveDate: values.leaveDate ? values.leaveDate.format(WIRE_DATE_FORMAT) : undefined,
        jobStatus: values.jobStatus,
        chargeHeadNum: values.chargeHeadNum || undefined,
      }
      if (isEdit) {
        const res = await apiClient.put<EmployeeDetail>(`/admin/employees/${id}`, body)
        message.success('已更新員工')
        goToListFor(res.data.companyId ?? undefined, res.data.dispatchCaseId ?? undefined)
      } else {
        const res = await apiClient.post<EmployeeDetail>('/admin/employees', {
          ...body,
          employeenum: values.employeenum,
          companyId: values.companyId,
          dispatchCaseId: values.dispatchCaseId,
        })
        message.success('已新增員工')
        goToListFor(res.data.companyId ?? undefined, res.data.dispatchCaseId ?? undefined)
      }
    } catch (err) {
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? (isEdit ? '更新失敗' : '新增失敗'))
    } finally {
      setSubmitting(false)
    }
  }

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
          <a onClick={() => navigate('/employees')}>員工維護</a>
          <span style={{ fontSize: 18, fontWeight: 600 }}>{isEdit ? '編輯員工' : '新增員工'}</span>
        </Space>
      </div>
      <div style={{ maxWidth: 560, margin: '32px auto', width: '100%', background: '#fff', borderRadius: 12, padding: 32 }}>
        <Spin spinning={loading}>
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            initialValues={{ role: '006', jobStatus: '001', sex: '001', takeDate: dayjs() }}
          >
            {isEdit ? (
              <>
                <Form.Item label="客戶名稱">
                  <Input value={detail?.companyName ?? ''} disabled />
                </Form.Item>
                <Form.Item label="個案編號">
                  <Input value={detail?.dispatchCaseCode ?? '未設定'} disabled />
                </Form.Item>
              </>
            ) : (
              <>
                <Form.Item name="employeenum" label="員工編號" rules={[{ required: true, message: '請輸入員工編號' }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="companyId" label="客戶" rules={[{ required: true, message: '請選擇客戶' }]}>
                  <Select
                    placeholder="選擇客戶"
                    options={companies.map((c) => ({ value: c.id, label: `${c.companyNum} ${c.chName}` }))}
                    onChange={(v) => {
                      setNewCompanyId(v)
                      form.setFieldValue('dispatchCaseId', undefined)
                    }}
                  />
                </Form.Item>
                <Form.Item name="dispatchCaseId" label="個案" rules={[{ required: true, message: '請選擇個案' }]}>
                  <Select
                    placeholder={newCompanyId ? '選擇個案' : '請先選擇客戶'}
                    disabled={!newCompanyId}
                    options={newDispatchCases.map((d) => ({ value: d.id, label: d.caseCode }))}
                  />
                </Form.Item>
              </>
            )}
            <Form.Item name="chname" label="中文姓名" rules={[{ required: true, message: '請輸入中文姓名' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="role" label="角色" rules={[{ required: true, message: '請選擇角色' }]}>
              <Select options={EMPLOYEE_ROLE_OPTIONS} />
            </Form.Item>
            <Form.Item name="jobStatus" label="在職狀態">
              <Select options={JOB_STATUS_OPTIONS} allowClear />
            </Form.Item>
            <Form.Item name="sex" label="性別">
              <Select options={SEX_OPTIONS} allowClear />
            </Form.Item>
            <Form.Item name="mobilePhone" label="手機">
              <Input />
            </Form.Item>
            <Space style={{ width: '100%' }}>
              <Form.Item name="takeDate" label="到職日">
                <DatePicker format={DATE_FORMAT} />
              </Form.Item>
              <Form.Item name="leaveDate" label="離職日">
                <DatePicker format={DATE_FORMAT} />
              </Form.Item>
            </Space>
            <Form.Item
              name="chargeHeadNum"
              label="簽核人員工編號"
              tooltip="輸入另一位員工的員工編號，儲存後系統會自動查找、算出真正的簽核主管"
            >
              <Input placeholder="員工編號" />
            </Form.Item>
            {isEdit && detail?.realChargeHeadNum && (
              <div style={{ marginTop: -16, marginBottom: 16, fontSize: 12, color: '#999' }}>
                目前算出的簽核主管：{detail.realChargeHeadNum}
              </div>
            )}
            {isEdit && detail && (
              <div style={{ marginBottom: 16, fontSize: 12, color: '#999' }}>
                建立時間：{formatDateTime(detail.createdAt)}　建立者：{detail.createdBy ?? '-'}　異動時間：
                {formatDateTime(detail.updatedAt)}　異動者：{detail.updatedBy ?? '-'}
              </div>
            )}
            <Form.Item style={{ marginBottom: 0 }}>
              <Space>
                <Button type="primary" htmlType="submit" loading={submitting}>
                  儲存
                </Button>
                <Button
                  onClick={() =>
                    isEdit
                      ? goToListFor(detail?.companyId ?? undefined, detail?.dispatchCaseId ?? undefined)
                      : goToListFor(newCompanyId, form.getFieldValue('dispatchCaseId'))
                  }
                >
                  取消
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Spin>
      </div>
    </Layout>
  )
}
