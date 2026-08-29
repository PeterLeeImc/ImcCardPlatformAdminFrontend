import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Form, Input, message, Modal } from 'antd'
import { apiClient } from '../api/client'

interface LoginFormValues {
  employeenum: string
  password: string
  captchaAnswer: string
}

interface LoginResponse {
  token: string
  chname: string
  mustChangePassword: boolean
  operatingCompanyId: number | null
  operatingCompanyName: string | null
}

export default function Login() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [captchaImage, setCaptchaImage] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [form] = Form.useForm<LoginFormValues>()

  const refreshCaptcha = async () => {
    try {
      const res = await apiClient.get('/auth/captcha')
      setCaptchaImage(res.data.image)
      setCaptchaToken(res.data.captchaToken)
    } catch {
      message.error('驗證碼載入失敗，請重新整理頁面')
    }
  }

  useEffect(() => {
    refreshCaptcha()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const doLogin = async (values: LoginFormValues, confirmed: boolean) => {
    const res = await apiClient.post<LoginResponse>('/auth/login', { ...values, captchaToken, confirmed })
    localStorage.setItem('platformToken', res.data.token)
    localStorage.setItem('platformChname', res.data.chname)
    localStorage.setItem('platformMustChangePassword', String(res.data.mustChangePassword))
    if (res.data.operatingCompanyId != null && res.data.operatingCompanyName != null) {
      localStorage.setItem('platformOperatingCompanyId', String(res.data.operatingCompanyId))
      localStorage.setItem('platformOperatingCompanyName', res.data.operatingCompanyName)
    } else {
      localStorage.removeItem('platformOperatingCompanyId')
      localStorage.removeItem('platformOperatingCompanyName')
    }
    navigate(res.data.mustChangePassword ? '/change-password' : '/')
  }

  const onFinish = async (values: LoginFormValues) => {
    setLoading(true)
    try {
      await doLogin(values, false)
    } catch (err) {
      const axiosErr = err as { response?: { status: number; data?: string } }
      if (axiosErr.response?.status === 409 && axiosErr.response.data === 'DUPLICATE_SESSION') {
        Modal.confirm({
          content: '此帳號已在其他地方登入中，是否要將舊的登入登出並繼續登入？',
          onOk: async () => {
            setLoading(true)
            try {
              await doLogin(values, true)
            } catch (err2) {
              const axiosErr2 = err2 as { response?: { data?: string } }
              message.error(axiosErr2.response?.data ?? '登入失敗')
              refreshCaptcha()
            } finally {
              setLoading(false)
            }
          },
        })
        return
      }
      message.error(axiosErr.response?.data ?? '登入失敗')
      refreshCaptcha()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f6f8' }}>
      <div style={{ width: 380, background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 1px 8px rgba(0,0,0,0.08)' }}>
        <h2 style={{ textAlign: 'center', marginTop: 0, marginBottom: 24 }}>IMC後台管理</h2>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="employeenum" label="帳號" rules={[{ required: true, message: '請輸入帳號' }]}>
            <Input placeholder="帳號" autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="密碼" rules={[{ required: true, message: '請輸入密碼' }]}>
            <Input.Password placeholder="密碼" autoComplete="current-password" />
          </Form.Item>
          <Form.Item name="captchaAnswer" label="驗證碼" rules={[{ required: true, message: '請輸入驗證碼' }]}>
            <Input placeholder="請輸入圖片中的驗證碼" />
          </Form.Item>
          {captchaImage && (
            <div style={{ marginTop: -12, marginBottom: 24 }}>
              <img
                src={captchaImage}
                alt="驗證碼"
                title="看不清楚？點一下換一張"
                style={{ height: 40, cursor: 'pointer' }}
                onClick={refreshCaptcha}
              />
            </div>
          )}
          <Form.Item style={{ marginBottom: 0 }}>
            <Button block type="primary" htmlType="submit" size="large" loading={loading}>
              登入
            </Button>
          </Form.Item>
        </Form>
        <div style={{ textAlign: 'center', fontSize: 12, color: '#999', marginTop: 16 }}>
          忘記密碼請聯繫系統管理者協助重設
        </div>
      </div>
    </div>
  )
}
