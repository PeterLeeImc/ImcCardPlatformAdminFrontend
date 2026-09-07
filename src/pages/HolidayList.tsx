import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  Layout,
  Modal,
  Space,
  Table,
  Upload,
  message,
} from 'antd'
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { apiClient } from '../api/client'
import type { HolidayItem, HolidayUpsertRequest, LogPage } from '../types'
import { formatDate } from '../utils/formatDate'
import { formatDateTime } from '../utils/formatDateTime'

const PAGE_SIZE = 50
const CURRENT_YEAR = String(new Date().getFullYear())
const DATE_FORMAT = 'YYYY/MM/DD'

interface ImportResult {
  successCount: number
  errors: string[]
}

export default function HolidayList() {
  const navigate = useNavigate()
  const [year, setYear] = useState(CURRENT_YEAR)
  const [data, setData] = useState<LogPage<HolidayItem>>()
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<HolidayItem | 'new'>()
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<{ day: dayjs.Dayjs; explain: string }>()

  const [file, setFile] = useState<File>()
  const [downloading, setDownloading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult>()

  const fetchRows = (targetPage: number) => {
    setLoading(true)
    apiClient
      .get<LogPage<HolidayItem>>('/admin/holidays', { params: { year, page: targetPage, size: PAGE_SIZE } })
      .then((res) => setData(res.data))
      .catch(() => message.error('載入假日檔失敗'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchRows(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, page])

  const openEdit = (row: HolidayItem | 'new') => {
    setEditing(row)
    if (row === 'new') {
      form.resetFields()
    } else {
      form.setFieldsValue({ day: dayjs(row.day), explain: row.explain })
    }
  }

  const submitEdit = async () => {
    if (!editing) return
    try {
      const values = await form.validateFields()
      const body: HolidayUpsertRequest = { day: values.day.format('YYYY-MM-DD'), explain: values.explain }
      setSaving(true)
      if (editing === 'new') {
        await apiClient.post('/admin/holidays', body)
        message.success('已新增假日')
      } else {
        await apiClient.put(`/admin/holidays/${editing.id}`, body)
        message.success('已更新假日')
      }
      setEditing(undefined)
      fetchRows(page)
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (row: HolidayItem) => {
    Modal.confirm({
      title: '確定要刪除這筆假日資料？',
      content: `${row.day} ${row.explain}`,
      okType: 'danger',
      onOk: async () => {
        try {
          await apiClient.delete(`/admin/holidays/${row.id}`)
          message.success('刪除成功')
          fetchRows(page)
        } catch (err) {
          const axiosErr = err as { response?: { data?: string } }
          message.error(axiosErr.response?.data ?? '刪除失敗')
        }
      },
    })
  }

  const downloadTemplate = async () => {
    setDownloading(true)
    try {
      const res = await apiClient.get('/admin/holidays/template', { responseType: 'blob' })
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = '假日檔匯入表.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      message.error('匯出失敗')
    } finally {
      setDownloading(false)
    }
  }

  const runImport = async () => {
    if (!file) return
    setImporting(true)
    setImportResult(undefined)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await apiClient.post<ImportResult>('/admin/holidays/import', formData)
      setImportResult(res.data)
      if (res.data.errors.length === 0) {
        message.success(`匯入完成，成功 ${res.data.successCount} 筆`)
        setFile(undefined)
      }
      // 即使有錯誤列，只要有任何一筆成功寫入，清單就要重新整理反映最新資料
      // (逐列各自獨立驗證/寫入，不是全部通過才寫入，見HolidayImportService)。
      if (res.data.successCount > 0) {
        fetchRows(page)
      }
    } catch (err) {
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? '匯入失敗')
    } finally {
      setImporting(false)
    }
  }

  const columns: ColumnsType<HolidayItem> = [
    { title: '日期', dataIndex: 'day', key: 'day', render: formatDate },
    { title: '假日說明', dataIndex: 'explain', key: 'explain' },
    { title: '建立時間', dataIndex: 'createdAt', key: 'createdAt', render: formatDateTime },
    { title: '建立者', dataIndex: 'createdBy', key: 'createdBy' },
    { title: '異動時間', dataIndex: 'updatedAt', key: 'updatedAt', render: formatDateTime },
    { title: '異動者', dataIndex: 'updatedBy', key: 'updatedBy' },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <a onClick={() => openEdit(record)}>編輯</a>
          <a onClick={() => handleDelete(record)} style={{ color: '#ff4d4f' }}>
            刪除
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
          justifyContent: 'space-between',
          padding: '16px 24px',
          background: '#fff',
          borderBottom: '1px solid #eee',
        }}
      >
        <Space>
          <a onClick={() => navigate('/')}>首頁</a>
          <span style={{ fontSize: 18, fontWeight: 600 }}>假日檔維護</span>
        </Space>
        <Button type="primary" onClick={() => openEdit('new')}>
          新增假日
        </Button>
      </div>
      <div style={{ padding: 24 }}>
        <div style={{ background: '#fff', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Excel批次匯出／匯入</div>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
            以「日期」為比對鍵：Excel裡的日期若資料庫已存在，會覆蓋原本的假日說明；不存在則新增一筆。範本＝目前全部假日資料，可直接下載後編輯再上傳；每一列各自獨立驗證，某幾列有誤不會影響其他正確列的寫入。
          </div>
          <Space wrap>
            <Button icon={<DownloadOutlined />} loading={downloading} onClick={downloadTemplate}>
              匯出範本／現況資料
            </Button>
            <Upload
              accept=".xlsx"
              maxCount={1}
              beforeUpload={(f) => {
                setFile(f)
                return false
              }}
              onRemove={() => setFile(undefined)}
            >
              <Button icon={<UploadOutlined />}>選擇檔案</Button>
            </Upload>
            <Button type="primary" loading={importing} disabled={!file} onClick={runImport}>
              匯入資料
            </Button>
          </Space>
          {importResult && (
            <div style={{ marginTop: 16 }}>
              {importResult.errors.length === 0 ? (
                <Alert type="success" showIcon message={`匯入完成，成功 ${importResult.successCount} 筆`} />
              ) : (
                <Alert
                  type="error"
                  showIcon
                  message={`匯入完成，成功 ${importResult.successCount} 筆，失敗 ${importResult.errors.length} 筆`}
                  description={
                    <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                      {importResult.errors.map((e, i) => (
                        <div key={i} style={{ fontSize: 12 }}>
                          {e}
                        </div>
                      ))}
                    </div>
                  }
                />
              )}
            </div>
          )}
        </div>

        <Space style={{ marginBottom: 16 }}>
          <Input
            style={{ width: 120 }}
            value={year}
            onChange={(e) => {
              setYear(e.target.value)
              setPage(0)
            }}
            placeholder="年度"
          />
        </Space>
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
        title={editing === 'new' ? '新增假日' : '編輯假日'}
        open={!!editing}
        onCancel={() => setEditing(undefined)}
        onOk={submitEdit}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="day" label="日期" rules={[{ required: true, message: '請選擇日期' }]}>
            <DatePicker style={{ width: '100%' }} format={DATE_FORMAT} />
          </Form.Item>
          <Form.Item name="explain" label="假日說明" rules={[{ required: true, message: '請輸入假日說明' }]}>
            <Input placeholder="例如：元旦、春節、颱風假" />
          </Form.Item>
        </Form>
        {editing && editing !== 'new' && (
          <div style={{ fontSize: 12, color: '#999' }}>
            建立時間：{formatDateTime(editing.createdAt)}　建立者：{editing.createdBy ?? '-'}　異動時間：
            {formatDateTime(editing.updatedAt)}　異動者：{editing.updatedBy ?? '-'}
          </div>
        )}
      </Modal>
    </Layout>
  )
}
