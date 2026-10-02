import { useCallback, useEffect, useState } from 'react'
import { Layout, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { apiClient } from '../api/client'
import type { AttendanceAnomalyItem, LogPage } from '../types'
import { compareDates, compareStrings } from '../utils/tableSort'
import PageHeader from '../components/PageHeader'
import ResultCount from '../components/ResultCount'
import PageSizeSelect from '../components/PageSizeSelect'

/**
 * 「出勤異常通知」：AttendanceAnomalyJob每5分鐘掃描一次，員工已排班卻拖到超過門檻還沒打卡時，
 * 系統自動發一筆站內通知給這個派遣個案的負責使用者(或系統管理者)，這裡就是查看/標記已讀的清單頁。
 * 跟員工端收到的「打卡提醒」是同一套偵測邏輯的另一段反應，但收件對象不同(這裡收件人是登入的
 * Manager自己，後端/api/admin/attendance-anomalies天生只回傳發給自己的，不用額外篩選客戶/個案)。
 * 點一列會標記已讀，跟PageHeader鈴鐺徽章共用同一份未讀數字來源，標記完要讓徽章也跟著減少
 * (用window事件通知，比照個案維護「設定個案」通知PageHeader即時更新的既有做法)。
 */
export default function AttendanceAnomalyList() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<LogPage<AttendanceAnomalyItem>>()
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  const fetchList = useCallback(async (targetPage: number, size: number) => {
    setLoading(true)
    try {
      const res = await apiClient.get<LogPage<AttendanceAnomalyItem>>('/admin/attendance-anomalies', {
        params: { page: targetPage, size },
      })
      setData(res.data)
    } catch (err) {
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? '載入出勤異常通知失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchList(page, pageSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize])

  const markRead = async (record: AttendanceAnomalyItem) => {
    if (record.read) return
    try {
      await apiClient.post(`/admin/attendance-anomalies/${record.id}/read`)
      setData((prev) =>
        prev
          ? { ...prev, content: prev.content.map((r) => (r.id === record.id ? { ...r, read: true } : r)) }
          : prev,
      )
      // 通知PageHeader的鈴鐺徽章重新查一次未讀數(跟OPERATING_DISPATCH_CASE_CHANGED_EVENT同樣模式，
      // 徽章輪詢間隔有45秒，這裡點了就立即更新，不用等下一次輪詢)。
      window.dispatchEvent(new Event('attendance-anomaly-read'))
    } catch {
      message.error('標記已讀失敗')
    }
  }

  const columns: ColumnsType<AttendanceAnomalyItem> = [
    {
      title: '序號',
      key: 'seq',
      width: 60,
      render: (_, __, index) => page * pageSize + index + 1,
    },
    {
      title: '客戶',
      dataIndex: 'companyName',
      key: 'companyName',
      width: 200,
      sorter: (a, b) => compareStrings(a.companyName, b.companyName),
    },
    {
      title: '個案編號',
      dataIndex: 'dispatchCaseCode',
      key: 'dispatchCaseCode',
      width: 140,
      sorter: (a, b) => compareStrings(a.dispatchCaseCode ?? '', b.dispatchCaseCode ?? ''),
    },
    { title: '內容', dataIndex: 'content', key: 'content' },
    {
      title: '時間',
      dataIndex: 'sentTime',
      key: 'sentTime',
      width: 160,
      sorter: (a, b) => compareDates(a.sentTime, b.sentTime),
    },
    {
      title: '狀態',
      dataIndex: 'read',
      key: 'read',
      width: 90,
      render: (read: boolean) => (read ? <Tag>已讀</Tag> : <Tag color="red">未讀</Tag>),
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f6f8' }}>
      <PageHeader title="出勤異常通知" />
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <ResultCount count={data?.totalElements} />
          <div style={{ width: 8 }} />
          <PageSizeSelect
            value={pageSize}
            onChange={(v) => {
              setPageSize(v)
              setPage(0)
            }}
          />
        </div>
        <Table
          rowKey={(record) => record.id}
          loading={loading}
          columns={columns}
          dataSource={data?.content ?? []}
          onRow={(record) => ({ onClick: () => markRead(record), style: { cursor: 'pointer' } })}
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
