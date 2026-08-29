import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Checkbox, Form, Input, Layout, Modal, Select, Space, Spin, message } from 'antd'
import { apiClient } from '../api/client'
import type { ComDepartmentItem, EmployeeDetail, EmployeeUpsertRequest } from '../types'
import { JOB_STATUS_OPTIONS, MARRIAGE_OPTIONS, ROLE_OPTIONS, SEX_OPTIONS } from '../types'

interface EmployeeFormValues {
  employeenum: string
  chname: string
  enname: string
  role: string
  idNum: string
  nation: string
  birthday: string
  sex: string
  marriage: string
  homePhone: string
  mobilePhone: string
  contactZipCode: string
  contactAddr: string
  registeredZipCode: string
  registeredAddr: string
  email: string
  takeDate: string
  leaveDate: string
  jobTitle: string
  jobStatus: string
  cardNum: string
  cardDataFrom: string
  chargeHeadNum: string
  disabilityLevel: string
  overtimePay: boolean
  leaveAttachment: boolean
  memo: string
}

export default function EmployeeForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const [form] = Form.useForm<EmployeeFormValues>()
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [detail, setDetail] = useState<EmployeeDetail>()
  const [deptModalOpen, setDeptModalOpen] = useState(false)
  const [departments, setDepartments] = useState<ComDepartmentItem[]>([])
  const [deptChanging, setDeptChanging] = useState(false)
  const [selectedDeptId, setSelectedDeptId] = useState<number>()

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
          enname: d.enname,
          role: d.role,
          idNum: d.idNum,
          nation: d.nation ?? '',
          birthday: d.birthday ?? '',
          sex: d.sex ?? undefined,
          marriage: d.marriage ?? undefined,
          homePhone: d.homePhone ?? '',
          mobilePhone: d.mobilePhone ?? '',
          contactZipCode: d.contactZipCode ?? '',
          contactAddr: d.contactAddr ?? '',
          registeredZipCode: d.registeredZipCode ?? '',
          registeredAddr: d.registeredAddr ?? '',
          email: d.email ?? '',
          takeDate: d.takeDate ?? '',
          leaveDate: d.leaveDate ?? '',
          jobTitle: d.jobTitle ?? '',
          jobStatus: d.jobStatus ?? undefined,
          cardNum: d.cardNum ?? '',
          cardDataFrom: d.cardDataFrom ?? '',
          chargeHeadNum: d.chargeHeadNum ?? '',
          disabilityLevel: d.disabilityLevel ?? '',
          overtimePay: d.overtimePay === 1,
          leaveAttachment: d.leaveAttachment === 1,
          memo: d.memo ?? '',
        })
      })
      .catch((err) => {
        const axiosErr = err as { response?: { data?: string } }
        message.error(axiosErr.response?.data ?? '載入員工資料失敗')
      })
      .finally(() => setLoading(false))
  }, [id, isEdit, form])

  const onFinish = async (values: EmployeeFormValues) => {
    setSubmitting(true)
    try {
      const body: EmployeeUpsertRequest = {
        chname: values.chname,
        enname: values.enname,
        role: values.role,
        idNum: values.idNum,
        nation: values.nation || undefined,
        birthday: values.birthday || undefined,
        sex: values.sex,
        marriage: values.marriage,
        homePhone: values.homePhone || undefined,
        mobilePhone: values.mobilePhone || undefined,
        contactZipCode: values.contactZipCode || undefined,
        contactAddr: values.contactAddr || undefined,
        registeredZipCode: values.registeredZipCode || undefined,
        registeredAddr: values.registeredAddr || undefined,
        email: values.email || undefined,
        takeDate: values.takeDate || undefined,
        leaveDate: values.leaveDate || undefined,
        jobTitle: values.jobTitle || undefined,
        jobStatus: values.jobStatus,
        cardNum: values.cardNum || undefined,
        cardDataFrom: values.cardDataFrom || undefined,
        chargeHeadNum: values.chargeHeadNum || undefined,
        disabilityLevel: values.disabilityLevel || undefined,
        overtimePay: !!values.overtimePay,
        leaveAttachment: !!values.leaveAttachment,
        memo: values.memo || undefined,
      }
      if (isEdit) {
        await apiClient.put(`/admin/employees/${id}`, body)
        message.success('已更新員工')
      } else {
        await apiClient.post('/admin/employees', { ...body, employeenum: values.employeenum })
        message.success('已新增員工')
      }
      navigate('/employees')
    } catch (err) {
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? (isEdit ? '更新失敗' : '新增失敗'))
    } finally {
      setSubmitting(false)
    }
  }

  const openDeptModal = () => {
    if (!detail?.companyId) return
    apiClient
      .get<ComDepartmentItem[]>(`/admin/companies/${detail.companyId}/departments`)
      .then((res) => setDepartments(res.data))
      .catch(() => message.error('載入部門清單失敗'))
    setSelectedDeptId(detail?.comDepartmentId ?? undefined)
    setDeptModalOpen(true)
  }

  const submitDeptChange = async () => {
    if (!id || !selectedDeptId) return
    setDeptChanging(true)
    try {
      const res = await apiClient.post<EmployeeDetail>(`/admin/employees/${id}/department`, {
        comDepartmentId: selectedDeptId,
      })
      setDetail(res.data)
      message.success('已異動部門，簽核主管已自動更新')
      setDeptModalOpen(false)
    } catch (err) {
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? '異動部門失敗')
    } finally {
      setDeptChanging(false)
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
      <div style={{ maxWidth: 720, margin: '32px auto', width: '100%', background: '#fff', borderRadius: 12, padding: 32 }}>
        <Spin spinning={loading}>
          {isEdit && (
            <div style={{ marginBottom: 24, padding: 16, background: '#f5f6f8', borderRadius: 8 }}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, color: '#999' }}>目前部門</div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{detail?.departmentName ?? '未設定'}</div>
                  <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                    部門主管(departHeadNum)：{detail?.departHeadNum ?? '無'}
                  </div>
                </div>
                <Button onClick={openDeptModal}>異動部門</Button>
              </Space>
            </div>
          )}
          <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ jobStatus: '001' }}>
            {!isEdit && (
              <Form.Item name="employeenum" label="員工編號" rules={[{ required: true, message: '請輸入員工編號' }]}>
                <Input />
              </Form.Item>
            )}
            <Form.Item name="chname" label="中文姓名" rules={[{ required: true, message: '請輸入中文姓名' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="enname" label="英文姓名" rules={[{ required: true, message: '請輸入英文姓名' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="idNum" label="身分證字號" rules={[{ required: true, message: '請輸入身分證字號' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="role" label="角色" rules={[{ required: true, message: '請選擇角色' }]}>
              <Select options={ROLE_OPTIONS} />
            </Form.Item>
            <Form.Item name="jobStatus" label="在職狀態">
              <Select options={JOB_STATUS_OPTIONS} allowClear />
            </Form.Item>
            <Form.Item name="sex" label="性別">
              <Select options={SEX_OPTIONS} allowClear />
            </Form.Item>
            <Form.Item name="marriage" label="婚姻狀況">
              <Select options={MARRIAGE_OPTIONS} allowClear />
            </Form.Item>
            <Form.Item name="birthday" label="生日(yyyy-MM-dd)">
              <Input placeholder="1990-01-01" />
            </Form.Item>
            <Form.Item name="nation" label="國別">
              <Input placeholder="TWN" />
            </Form.Item>
            <Form.Item name="homePhone" label="住家電話">
              <Input />
            </Form.Item>
            <Form.Item name="mobilePhone" label="手機">
              <Input />
            </Form.Item>
            <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Email格式不正確' }]}>
              <Input />
            </Form.Item>
            <Space style={{ width: '100%' }}>
              <Form.Item name="contactZipCode" label="通訊地址郵遞區號">
                <Input style={{ width: 140 }} />
              </Form.Item>
              <Form.Item name="contactAddr" label="通訊地址" style={{ flex: 1 }}>
                <Input />
              </Form.Item>
            </Space>
            <Space style={{ width: '100%' }}>
              <Form.Item name="registeredZipCode" label="戶籍地址郵遞區號">
                <Input style={{ width: 140 }} />
              </Form.Item>
              <Form.Item name="registeredAddr" label="戶籍地址" style={{ flex: 1 }}>
                <Input />
              </Form.Item>
            </Space>
            <Space style={{ width: '100%' }}>
              <Form.Item name="takeDate" label="到職日(yyyy-MM-dd)">
                <Input placeholder="2026-01-01" />
              </Form.Item>
              <Form.Item name="leaveDate" label="離職日(yyyy-MM-dd)">
                <Input placeholder="2026-12-31" />
              </Form.Item>
            </Space>
            <Form.Item name="jobTitle" label="職稱">
              <Input />
            </Form.Item>
            <Space style={{ width: '100%' }}>
              <Form.Item name="cardNum" label="打卡卡號">
                <Input style={{ width: 200 }} />
              </Form.Item>
              <Form.Item name="cardDataFrom" label="卡號來源">
                <Input style={{ width: 200 }} />
              </Form.Item>
            </Space>
            <Form.Item
              name="chargeHeadNum"
              label="第一層(先簽)簽核人員工編號"
              tooltip="輸入另一位員工的員工編號，儲存後系統會自動查找、算出真正的直屬簽核主管"
            >
              <Input placeholder="員工編號" />
            </Form.Item>
            {isEdit && detail?.realChargeHeadNum && (
              <div style={{ marginTop: -16, marginBottom: 16, fontSize: 12, color: '#999' }}>
                目前算出的直屬簽核主管：{detail.realChargeHeadNum}
              </div>
            )}
            <Form.Item name="disabilityLevel" label="身心障礙等級">
              <Input />
            </Form.Item>
            <Form.Item name="overtimePay" valuePropName="checked">
              <Checkbox>加班可轉換成加班費</Checkbox>
            </Form.Item>
            <Form.Item name="leaveAttachment" valuePropName="checked">
              <Checkbox>請假需要附件</Checkbox>
            </Form.Item>
            <Form.Item name="memo" label="備註">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Space>
                <Button type="primary" htmlType="submit" loading={submitting}>
                  儲存
                </Button>
                <Button onClick={() => navigate('/employees')}>取消</Button>
              </Space>
            </Form.Item>
          </Form>
        </Spin>
      </div>
      <Modal
        title="異動部門"
        open={deptModalOpen}
        onCancel={() => setDeptModalOpen(false)}
        onOk={submitDeptChange}
        confirmLoading={deptChanging}
        destroyOnHidden
      >
        <div style={{ marginBottom: 12, fontSize: 13, color: '#666' }}>
          異動後會依角色規則自動更新這位員工的部門主管簽核人設定。
        </div>
        <Select
          style={{ width: '100%' }}
          placeholder="選擇新部門"
          value={selectedDeptId}
          onChange={setSelectedDeptId}
          options={departments.map((d) => ({ value: d.id, label: `${d.deptId} ${d.deptName}` }))}
        />
      </Modal>
    </Layout>
  )
}
