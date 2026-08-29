import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Form, Input, Layout, Modal, Space, Table, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { apiClient } from '../api/client'
import type { BroadcastNotificationRequest, LogPage, NotificationItem } from '../types'

const PAGE_SIZE = 20

export default function NotificationBroadcast() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<LogPage<NotificationItem>>()
  const [page, setPage] = useState(0)
  const [composeOpen, setComposeOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [form] = Form.useForm<BroadcastNotificationRequest>()

  const fetchNotifications = useCallback(async (targetPage: number) => {
    setLoading(true)
    try {
      const res = await apiClient.get<LogPage<NotificationItem>>('/admin/notifications', {
        params: { page: targetPage, size: PAGE_SIZE },
      })
      setData(res.data)
    } catch (err) {
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? '載入通知紀錄失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications(page)
  }, [page, fetchNotifications])

  const submitBroadcast = async () => {
    try {
      const values = await form.validateFields()
      setSending(true)
      await apiClient.post('/admin/notifications', values)
      message.success('已發送全公司廣播')
      setComposeOpen(false)
      form.resetFields()
      setPage(0)
      fetchNotifications(0)
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        return
      }
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? '發送失敗')
    } finally {
      setSending(false)
    }
  }

  const columns: ColumnsType<NotificationItem> = [
    { title: '主旨', dataIndex: 'subject', key: 'subject' },
    { title: '內容', dataIndex: 'content', key: 'content', ellipsis: true },
    { title: '發送人', dataIndex: 'senderName', key: 'senderName', width: 140 },
    { title: '發送時間', dataIndex: 'sentTime', key: 'sentTime', width: 160 },
  ]

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
        <Space>
          <a onClick={() => navigate('/')}>首頁</a>
          <span style={{ fontSize: 18, fontWeight: 600 }}>通知</span>
        </Space>
        <Button type="primary" onClick={() => setComposeOpen(true)}>
          發送全公司廣播
        </Button>
      </div>
      <div style={{ padding: 24 }}>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data?.content ?? []}
          pagination={{
            current: page + 1,
            pageSize: PAGE_SIZE,
            total: data?.totalElements ?? 0,
            showSizeChanger: false,
            onChange: (nextPage) => setPage(nextPage - 1),
          }}
        />
      </div>
      <Modal
        title="發送全公司廣播"
        open={composeOpen}
        onCancel={() => setComposeOpen(false)}
        onOk={submitBroadcast}
        confirmLoading={sending}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="subject" label="主旨" rules={[{ required: true, message: '請輸入主旨' }]}>
            <Input placeholder="主旨" />
          </Form.Item>
          <Form.Item name="content" label="內容" rules={[{ required: true, message: '請輸入內容' }]}>
            <Input.TextArea placeholder="內容" rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  )
}
