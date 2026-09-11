import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Form, Input, message, Layout } from 'antd'
import { apiClient } from '../api/client'

const PASSWORD_RULE = /^[a-zA-Z][0-9a-zA-Z]{3,}$/

interface ChangePasswordFormValues {
  oldPassword: string
  newPassword: string
  confirmPassword: string
}

export default function ChangePassword() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const mustChangePassword = localStorage.getItem('platformMustChangePassword') === 'true'

  const logout = () => {
    localStorage.removeItem('platformToken')
    localStorage.removeItem('platformChname')
    localStorage.removeItem('platformMustChangePassword')
    localStorage.removeItem('platformOperatingCompanyId')
    localStorage.removeItem('platformOperatingCompanyName')
    navigate('/login')
  }

  const onFinish = async (values: ChangePasswordFormValues) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('兩次輸入的新密碼不一致')
      return
    }
    setLoading(true)
    try {
      await apiClient.post('/auth/change-password', {
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      })
      message.success('已變更密碼並自動登出，下次以新密碼登入。')
      logout()
    } catch (err) {
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? '變更密碼失敗')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f6f8' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          background: '#fff',
          borderBottom: '1px solid #eee',
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 600 }}>變更密碼</span>
        {!mustChangePassword && (
          <span onClick={logout} style={{ fontSize: 14, cursor: 'pointer', color: '#1677ff' }}>
            登出
          </span>
        )}
      </div>
      <div style={{ maxWidth: 420, margin: '32px auto', width: '100%', background: '#fff', borderRadius: 12, padding: 32 }}>
        {mustChangePassword && (
          <div style={{ marginBottom: 16, color: '#e65100', fontSize: 14 }}>
            首次登入請先變更密碼，變更後需用新密碼重新登入。
          </div>
        )}
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="oldPassword" label="原密碼" rules={[{ required: true, message: '請輸入原密碼' }]}>
            <Input.Password placeholder="原密碼" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="新密碼"
            rules={[
              { required: true, message: '請輸入新密碼' },
              { pattern: PASSWORD_RULE, message: '需以英文字母開頭，長度至少4碼，且只能是英文字母或數字' },
            ]}
          >
            <Input.Password placeholder="新密碼" />
          </Form.Item>
          <Form.Item name="confirmPassword" label="確認新密碼" rules={[{ required: true, message: '請再輸入一次新密碼' }]}>
            <Input.Password placeholder="確認新密碼" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button block type="primary" htmlType="submit" size="large" loading={loading}>
              變更密碼
            </Button>
          </Form.Item>
        </Form>
        <div style={{ marginTop: 12, fontSize: 12, color: '#999' }}>
          ※新密碼需以英文字母開頭，長度至少4碼，只能是英文字母或數字
        </div>
      </div>
    </Layout>
  )
}
