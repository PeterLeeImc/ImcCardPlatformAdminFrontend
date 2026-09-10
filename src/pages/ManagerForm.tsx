import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Form, Input, Layout, Select, Space, Spin, message } from 'antd'
import { apiClient } from '../api/client'
import type { ManagerCreateRequest, ManagerDetail, ManagerUpdateRequest, SalesLookupResult } from '../types'
import { ENABLED_OPTIONS, MANAGER_ROLE_OPTIONS } from '../types'
import { formatDateTime } from '../utils/formatDateTime'

const PASSWORD_RULE = /^[a-zA-Z][0-9a-zA-Z]{3,}$/
const SALES_ROLE = '004'

interface ManagerFormValues {
  account: string
  username: string
  password: string
  email: string
  enabled: string
  role: string
}

export default function ManagerForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const [form] = Form.useForm<ManagerFormValues>()
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [detail, setDetail] = useState<ManagerDetail>()
  const [salesSerial, setSalesSerial] = useState('')
  const [salesLookupLoading, setSalesLookupLoading] = useState(false)

  useEffect(() => {
    if (!isEdit) return
    setLoading(true)
    apiClient
      .get<ManagerDetail>(`/admin/managers/${id}`)
      .then((res) => {
        setDetail(res.data)
        form.setFieldsValue({
          account: res.data.account,
          username: res.data.username,
          email: res.data.email,
          enabled: res.data.enabled,
          role: res.data.role,
        })
      })
      .catch((err) => {
        const axiosErr = err as { response?: { data?: string } }
        message.error(axiosErr.response?.data ?? '載入使用者資料失敗')
      })
      .finally(() => setLoading(false))
  }, [id, isEdit, form])

  const lookupSales = async () => {
    if (!salesSerial.trim()) {
      message.error('請輸入業務代號')
      return
    }
    setSalesLookupLoading(true)
    try {
      const res = await apiClient.get<SalesLookupResult>('/admin/managers/lookup-sales', {
        params: { serial: salesSerial.trim() },
      })
      form.setFieldsValue({
        account: res.data.account,
        username: res.data.chName,
        email: res.data.email,
        role: SALES_ROLE,
      })
      form.setFieldValue('enabled', '1')
      message.success('已帶入IMC業務資料，請確認後再儲存')
    } catch (err) {
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? '查詢業務代號失敗')
    } finally {
      setSalesLookupLoading(false)
    }
  }

  const onFinish = async (values: ManagerFormValues) => {
    setSubmitting(true)
    try {
      if (isEdit) {
        const body: ManagerUpdateRequest = {
          username: values.username,
          email: values.email,
          enabled: values.enabled,
          role: values.role,
        }
        await apiClient.put(`/admin/managers/${id}`, body)
        message.success('已更新使用者')
      } else {
        const body: ManagerCreateRequest = {
          account: values.account,
          username: values.username,
          password: values.password,
          email: values.email,
          enabled: values.enabled,
          role: values.role,
        }
        await apiClient.post('/admin/managers', body)
        message.success('已新增使用者')
      }
      navigate('/managers')
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
          <a onClick={() => navigate('/managers')}>使用者維護</a>
          <span style={{ fontSize: 18, fontWeight: 600 }}>{isEdit ? '編輯使用者' : '新增使用者'}</span>
        </Space>
      </div>
      <div style={{ maxWidth: 480, margin: '32px auto', width: '100%', background: '#fff', borderRadius: 12, padding: 32 }}>
        <Spin spinning={loading}>
          {!isEdit && (
            <div style={{ marginBottom: 24, padding: 16, background: '#f5f6f8', borderRadius: 8 }}>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
                若是新增業務帳號，可先輸入業務代號查詢IMC系統，自動帶入下方帳號/使用者名稱/Email/角色/狀態
              </div>
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  placeholder="業務代號"
                  value={salesSerial}
                  onChange={(e) => setSalesSerial(e.target.value)}
                  onPressEnter={lookupSales}
                />
                <Button onClick={lookupSales} loading={salesLookupLoading}>
                  查詢
                </Button>
              </Space.Compact>
            </div>
          )}
          <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ enabled: '1' }}>
            {isEdit ? (
              <Form.Item label="帳號" tooltip="IMC使用者帳號">
                <Input value={detail?.account} disabled />
              </Form.Item>
            ) : (
              <Form.Item
                name="account"
                label="帳號"
                tooltip="IMC使用者帳號"
                rules={[{ required: true, message: '請輸入帳號' }]}
              >
                <Input placeholder="帳號" autoComplete="off" />
              </Form.Item>
            )}
            <Form.Item name="username" label="使用者名稱" rules={[{ required: true, message: '請輸入使用者名稱' }]}>
              <Input placeholder="使用者名稱" />
            </Form.Item>
            {!isEdit && (
              <Form.Item
                name="password"
                label="密碼"
                rules={[
                  { required: true, message: '請輸入密碼' },
                  {
                    pattern: PASSWORD_RULE,
                    message: '密碼格式錯誤：需以英文字母開頭，長度至少4碼，且只能是英文字母或數字',
                  },
                ]}
              >
                <Input.Password placeholder="密碼" autoComplete="new-password" />
              </Form.Item>
            )}
            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: '請輸入Email' },
                { type: 'email', message: 'Email格式不正確' },
              ]}
            >
              <Input placeholder="Email" />
            </Form.Item>
            <Form.Item name="role" label="角色" rules={[{ required: true, message: '請選擇角色' }]}>
              <Select options={MANAGER_ROLE_OPTIONS} placeholder="請選擇角色" />
            </Form.Item>
            {/* enabled為舊ZK系統遺留的字串型boolean-ish欄位，新畫面簡化為啟用/停用兩個選項 */}
            <Form.Item name="enabled" label="狀態" rules={[{ required: true, message: '請選擇狀態' }]}>
              <Select options={ENABLED_OPTIONS} placeholder="請選擇狀態" />
            </Form.Item>
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
                <Button onClick={() => navigate('/managers')}>取消</Button>
              </Space>
            </Form.Item>
          </Form>
        </Spin>
      </div>
    </Layout>
  )
}
