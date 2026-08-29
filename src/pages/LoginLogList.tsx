import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, DatePicker, Form, Input, Layout, Space, Table, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { Dayjs } from 'dayjs'
import { apiClient } from '../api/client'
import type { LogPage, RwdLoginLogItem } from '../types'

const PAGE_SIZE = 20

interface FilterValues {
  range?: [Dayjs, Dayjs]
  account?: string
}

export default function LoginLogList() {
  const navigate = useNavigate()
  const [form] = Form.useForm<FilterValues>()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<LogPage<RwdLoginLogItem>>()
  const [page, setPage] = useState(0)

  const fetchLogs = useCallback(async (targetPage: number, filters: FilterValues) => {
    setLoading(true)
    try {
      const res = await apiClient.get<LogPage<RwdLoginLogItem>>('/admin/login-logs', {
        params: {
          page: targetPage,
          size: PAGE_SIZE,
          from: filters.range?.[0]?.format('YYYY-MM-DD'),
          to: filters.range?.[1]?.format('YYYY-MM-DD'),
          account: filters.account || undefined,
        },
      })
      setData(res.data)
    } catch (err) {
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? '載入登入紀錄失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs(page, form.getFieldsValue())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const onSearch = (values: FilterValues) => {
    setPage(0)
    fetchLogs(0, values)
  }

  const columns: ColumnsType<RwdLoginLogItem> = [
    { title: '帳號', dataIndex: 'employeenum', key: 'employeenum', width: 140 },
    { title: '姓名', dataIndex: 'chname', key: 'chname', width: 140 },
    { title: '登入時間', dataIndex: 'loginTime', key: 'loginTime', width: 180 },
    { title: 'IP', dataIndex: 'ip', key: 'ip' },
  ]

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
          <a onClick={() => navigate('/')}>首頁</a>
          <span style={{ fontSize: 18, fontWeight: 600 }}>登入紀錄</span>
        </Space>
      </div>
      <div style={{ padding: 24 }}>
        <Form form={form} layout="inline" onFinish={onSearch} style={{ marginBottom: 16 }}>
          <Form.Item name="range" label="日期區間">
            <DatePicker.RangePicker />
          </Form.Item>
          <Form.Item name="account" label="帳號">
            <Input placeholder="員工編號" allowClear style={{ width: 160 }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                查詢
              </Button>
              <Button
                onClick={() => {
                  form.resetFields()
                  setPage(0)
                  fetchLogs(0, {})
                }}
              >
                清除
              </Button>
            </Space>
          </Form.Item>
        </Form>
        <Table
          rowKey={(record) => `${record.employeenum}-${record.loginTime}`}
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
    </Layout>
  )
}
