import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout, Modal, Space, Switch, Table, Tag, TimePicker, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { apiClient } from '../api/client'
import type { ScheduledJobItem, ScheduledJobUpdateRequest } from '../types'
import { formatDateTime } from '../utils/formatDateTime'

const TIME_FORMAT = 'HH:mm'

/** 這個系統的排程都是「每天固定某個時間點觸發一次」，cron固定是"0 分 時 * * *"這個形狀，
 * 這裡只需要把時間選擇器編輯的HH:mm跟這個形狀互相轉換，不用讓管理端使用者直接寫cron語法。 */
function cronToTime(cron: string): dayjs.Dayjs | null {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 6) return null
  const [, minute, hour] = parts
  const h = Number(hour)
  const m = Number(minute)
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null
  return dayjs().hour(h).minute(m).second(0)
}

function timeToCron(time: dayjs.Dayjs): string {
  return `0 ${time.minute()} ${time.hour()} * * *`
}

export default function ScheduledJobList() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<ScheduledJobItem[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<ScheduledJobItem>()
  const [editTime, setEditTime] = useState<dayjs.Dayjs | null>(null)
  const [editEnabled, setEditEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState<string>()

  const fetchRows = () => {
    setLoading(true)
    apiClient
      .get<ScheduledJobItem[]>('/admin/scheduled-jobs')
      .then((res) => setRows(res.data))
      .catch((err) => {
        const axiosErr = err as { response?: { data?: string } }
        message.error(axiosErr.response?.data ?? '載入排程清單失敗')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchRows()
  }, [])

  const openEdit = (row: ScheduledJobItem) => {
    setEditing(row)
    setEditTime(cronToTime(row.cronExpression))
    setEditEnabled(row.enabled)
  }

  const submitEdit = async () => {
    if (!editing || !editTime) {
      message.error('請選擇執行時間')
      return
    }
    setSaving(true)
    try {
      const body: ScheduledJobUpdateRequest = { cronExpression: timeToCron(editTime), enabled: editEnabled }
      const res = await apiClient.put<ScheduledJobItem>(`/admin/scheduled-jobs/${editing.jobKey}`, body)
      setRows((prev) => prev.map((r) => (r.jobKey === res.data.jobKey ? res.data : r)))
      message.success('已更新排程設定')
      setEditing(undefined)
    } catch (err) {
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? '更新失敗')
    } finally {
      setSaving(false)
    }
  }

  const runNow = (row: ScheduledJobItem) => {
    Modal.confirm({
      title: '確定要立即手動執行這個排程工作？',
      content: (
        <>
          {row.displayName}
          <br />
          不受目前是否啟用/時間設定限制，會立即執行一次。
        </>
      ),
      onOk: async () => {
        setRunning(row.jobKey)
        try {
          const res = await apiClient.post<ScheduledJobItem>(`/admin/scheduled-jobs/${row.jobKey}/run`)
          setRows((prev) => prev.map((r) => (r.jobKey === res.data.jobKey ? res.data : r)))
          message.success(res.data.lastRunMessage ?? '執行完成')
        } catch (err) {
          const axiosErr = err as { response?: { data?: string } }
          message.error(axiosErr.response?.data ?? '執行失敗')
          fetchRows()
        } finally {
          setRunning(undefined)
        }
      },
    })
  }

  const columns: ColumnsType<ScheduledJobItem> = [
    { title: '排程名稱', dataIndex: 'displayName', key: 'displayName', width: 200 },
    { title: '說明', dataIndex: 'description', key: 'description' },
    {
      title: '執行時間',
      key: 'time',
      width: 100,
      render: (_, record) => {
        const time = cronToTime(record.cronExpression)
        return time ? time.format(TIME_FORMAT) : record.cronExpression
      },
    },
    {
      title: '自動執行',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 90,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '啟用' : '停用'}</Tag>,
    },
    {
      title: '最後執行時間',
      dataIndex: 'lastRunAt',
      key: 'lastRunAt',
      width: 170,
      render: (v: string | null) => formatDateTime(v),
    },
    {
      title: '最後執行結果',
      key: 'lastRun',
      width: 200,
      render: (_, record) =>
        record.lastRunAt ? (
          <>
            <Tag color={record.lastRunSuccess ? 'blue' : 'red'}>{record.lastRunSuccess ? '成功' : '失敗'}</Tag>
            <span style={{ fontSize: 12, color: '#666' }}>{record.lastRunMessage}</span>
            <div style={{ fontSize: 12, color: '#999' }}>觸發者：{record.lastRunBy ?? '-'}</div>
          </>
        ) : (
          '尚未執行過'
        ),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_, record) => (
        <Space>
          <a onClick={() => openEdit(record)}>設定時間</a>
          <a onClick={() => (running ? undefined : runNow(record))} aria-disabled={running === record.jobKey}>
            {running === record.jobKey ? '執行中...' : '手動執行'}
          </a>
        </Space>
      ),
    },
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
          <span style={{ fontSize: 18, fontWeight: 600 }}>排程管理</span>
        </Space>
      </div>
      <div style={{ padding: 24 }}>
        <Table rowKey="jobKey" loading={loading} columns={columns} dataSource={rows} pagination={false} />
      </div>
      <Modal
        title={`設定執行時間${editing ? ` - ${editing.displayName}` : ''}`}
        open={!!editing}
        onCancel={() => setEditing(undefined)}
        onOk={submitEdit}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <div style={{ marginBottom: 8 }}>每天執行時間</div>
            <TimePicker value={editTime} onChange={setEditTime} format={TIME_FORMAT} minuteStep={5} style={{ width: '100%' }} />
          </div>
          <div>
            <Switch checked={editEnabled} onChange={setEditEnabled} checkedChildren="啟用自動執行" unCheckedChildren="停用自動執行" />
          </div>
        </Space>
      </Modal>
    </Layout>
  )
}
