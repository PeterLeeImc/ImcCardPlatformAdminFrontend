import { useEffect, useState } from 'react'
import { InputNumber, Layout, Modal, Radio, Space, Switch, Table, Tag, TimePicker, message } from 'antd'
import { ClockCircleOutlined, PlayCircleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { apiClient } from '../api/client'
import type { ScheduledJobItem, ScheduledJobUpdateRequest } from '../types'
import { formatDateTime } from '../utils/formatDateTime'
import PageHeader from '../components/PageHeader'
import ActionIcon from '../components/ActionIcon'
import ResultCount from '../components/ResultCount'
import PageSizeSelect from '../components/PageSizeSelect'

const TIME_FORMAT = 'HH:mm'

/**
 * 這個系統的排程大多是「每天固定某個時間點觸發一次」，cron是"0 分 時 * * *"這個形狀；但生理假
 * 這種按月發放的排程是"0 分 時 幾號 * *"(日欄位不是*，而是1~31的固定數字)，這裡把「每天」跟
 * 「每月第幾天」兩種形狀都解析出來，讓編輯畫面可以正確顯示、儲存時也不會把月排程誤存成天天觸發。
 */
function parseCron(cron: string): { time: dayjs.Dayjs | null; dayOfMonth: number | null } {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 6) return { time: null, dayOfMonth: null }
  const [, minute, hour, dayOfMonthField] = parts
  const h = Number(hour)
  const m = Number(minute)
  if (!Number.isInteger(h) || !Number.isInteger(m)) return { time: null, dayOfMonth: null }
  const dayOfMonth = dayOfMonthField === '*' ? null : Number(dayOfMonthField)
  return { time: dayjs().hour(h).minute(m).second(0), dayOfMonth: Number.isInteger(dayOfMonth) ? dayOfMonth : null }
}

function buildCron(time: dayjs.Dayjs, dayOfMonth: number | null): string {
  return `0 ${time.minute()} ${time.hour()} ${dayOfMonth ?? '*'} * *`
}

export default function ScheduledJobList() {
  const [rows, setRows] = useState<ScheduledJobItem[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<ScheduledJobItem>()
  const [editTime, setEditTime] = useState<dayjs.Dayjs | null>(null)
  const [editFrequency, setEditFrequency] = useState<'daily' | 'monthly'>('daily')
  const [editDayOfMonth, setEditDayOfMonth] = useState(1)
  const [editEnabled, setEditEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState<string>()
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)

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
    const { time, dayOfMonth } = parseCron(row.cronExpression)
    setEditTime(time)
    setEditFrequency(dayOfMonth == null ? 'daily' : 'monthly')
    setEditDayOfMonth(dayOfMonth ?? 1)
    setEditEnabled(row.enabled)
  }

  const submitEdit = async () => {
    if (!editing || !editTime) {
      message.error('請選擇執行時間')
      return
    }
    setSaving(true)
    try {
      const body: ScheduledJobUpdateRequest = {
        cronExpression: buildCron(editTime, editFrequency === 'monthly' ? editDayOfMonth : null),
        enabled: editEnabled,
      }
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
    {
      title: '序號',
      key: 'seq',
      width: 60,
      render: (_, __, index) => page * pageSize + index + 1,
    },
    { title: '排程名稱', dataIndex: 'displayName', key: 'displayName', width: 200 },
    { title: '說明', dataIndex: 'description', key: 'description' },
    {
      title: '執行時間',
      key: 'time',
      width: 140,
      render: (_, record) => {
        const { time, dayOfMonth } = parseCron(record.cronExpression)
        if (!time) return record.cronExpression
        return dayOfMonth == null ? `每天 ${time.format(TIME_FORMAT)}` : `每月${dayOfMonth}號 ${time.format(TIME_FORMAT)}`
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
        <Space size="small">
          <ActionIcon title="設定時間" icon={<ClockCircleOutlined />} onClick={() => openEdit(record)} />
          <ActionIcon
            title={running === record.jobKey ? '執行中...' : '手動執行'}
            icon={<PlayCircleOutlined />}
            disabled={running === record.jobKey}
            onClick={() => runNow(record)}
          />
        </Space>
      ),
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f6f8' }}>
      <PageHeader title="排程管理" />
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <Space>
            <ResultCount count={rows.length} />
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
          rowKey="jobKey"
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={{
            current: page + 1,
            pageSize,
            total: rows.length,
            showSizeChanger: false,
            onChange: (nextPage) => setPage(nextPage - 1),
          }}
        />
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
            <div style={{ marginBottom: 8 }}>觸發頻率</div>
            <Radio.Group
              value={editFrequency}
              onChange={(e) => setEditFrequency(e.target.value)}
              options={[
                { label: '每天', value: 'daily' },
                { label: '每月固定一天', value: 'monthly' },
              ]}
            />
          </div>
          {editFrequency === 'monthly' && (
            <div>
              <div style={{ marginBottom: 8 }}>每月第幾天執行</div>
              <InputNumber
                value={editDayOfMonth}
                onChange={(v) => setEditDayOfMonth(v ?? 1)}
                min={1}
                max={31}
                addonAfter="號"
                style={{ width: 140 }}
              />
            </div>
          )}
          <div>
            <div style={{ marginBottom: 8 }}>執行時間</div>
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
