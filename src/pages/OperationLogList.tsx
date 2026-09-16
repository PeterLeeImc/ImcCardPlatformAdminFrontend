import { useCallback, useEffect, useState } from 'react'
import { Button, DatePicker, Form, Input, Layout, Space, Table, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { Dayjs } from 'dayjs'
import { apiClient } from '../api/client'
import type { LogPage, RwdOperationLogItem } from '../types'
import { compareDates, compareStrings } from '../utils/tableSort'
import { formatDateTime } from '../utils/formatDateTime'
import PageHeader from '../components/PageHeader'
import ResultCount from '../components/ResultCount'
import PageSizeSelect from '../components/PageSizeSelect'

interface FilterValues {
  range?: [Dayjs, Dayjs]
  function?: string
  account?: string
}

export default function OperationLogList() {
  const [form] = Form.useForm<FilterValues>()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<LogPage<RwdOperationLogItem>>()
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  const fetchLogs = useCallback(async (targetPage: number, filters: FilterValues, size: number) => {
    setLoading(true)
    try {
      const res = await apiClient.get<LogPage<RwdOperationLogItem>>('/admin/operation-logs', {
        params: {
          page: targetPage,
          size,
          from: filters.range?.[0]?.format('YYYY-MM-DD'),
          to: filters.range?.[1]?.format('YYYY-MM-DD'),
          function: filters.function || undefined,
          account: filters.account || undefined,
        },
      })
      setData(res.data)
    } catch (err) {
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? '載入操作記錄失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs(page, form.getFieldsValue(), pageSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize])

  const onSearch = (values: FilterValues) => {
    setPage(0)
    fetchLogs(0, values, pageSize)
  }

  const columns: ColumnsType<RwdOperationLogItem> = [
    {
      title: '序號',
      key: 'seq',
      width: 60,
      render: (_, __, index) => page * pageSize + index + 1,
    },
    {
      title: '帳號',
      dataIndex: 'employeenum',
      key: 'employeenum',
      width: 120,
      sorter: (a, b) => compareStrings(a.employeenum, b.employeenum),
    },
    {
      title: '姓名',
      dataIndex: 'chname',
      key: 'chname',
      width: 120,
      sorter: (a, b) => compareStrings(a.chname, b.chname),
    },
    {
      title: '功能',
      dataIndex: 'function',
      key: 'function',
      width: 140,
      sorter: (a, b) => compareStrings(a.function, b.function),
    },
    { title: '動作', dataIndex: 'action', key: 'action', sorter: (a, b) => compareStrings(a.action, b.action) },
    {
      title: '時間',
      dataIndex: 'operationTime',
      key: 'operationTime',
      width: 180,
      render: formatDateTime,
      sorter: (a, b) => compareDates(a.operationTime, b.operationTime),
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f6f8' }}>
      <PageHeader title="操作記錄" />
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
          <Form form={form} layout="inline" onFinish={onSearch} style={{ marginBottom: 16 }}>
            <Form.Item name="range" label="日期區間">
              <DatePicker.RangePicker format="YYYY/MM/DD" />
            </Form.Item>
            <Form.Item name="function" label="功能">
              <Input placeholder="功能名稱" allowClear style={{ width: 160 }} />
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
                    fetchLogs(0, {}, pageSize)
                  }}
                >
                  清除
                </Button>
              </Space>
            </Form.Item>
          </Form>
          <Space>
            <ResultCount count={data?.totalElements} />
            <PageSizeSelect
              value={pageSize}
              onChange={(v) => {
                setPageSize(v)
                setPage(0)
              }}
            />
          </Space>
        </div>
        <Table
          rowKey={(record) => `${record.employeenum}-${record.operationTime}-${record.action}`}
          loading={loading}
          columns={columns}
          dataSource={data?.content ?? []}
          pagination={{
            current: page + 1,
            pageSize,
            total: data?.totalElements ?? 0,
            showSizeChanger: false,
            onChange: (nextPage) => setPage(nextPage - 1),
          }}
        />
      </div>
    </Layout>
  )
}
