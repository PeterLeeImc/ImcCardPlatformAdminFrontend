import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Layout, Space, Tabs, Upload, message } from 'antd'
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons'
import { apiClient } from '../api/client'

interface ImportResult {
  successCount: number
  errors: string[]
}

function BatchImportPanel({
  description,
  templateUrl,
  templateFilename,
  importUrl,
}: {
  description: string
  templateUrl: string
  templateFilename: string
  importUrl: string
}) {
  const [file, setFile] = useState<File>()
  const [downloading, setDownloading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult>()

  const downloadTemplate = async () => {
    setDownloading(true)
    try {
      const res = await apiClient.get(templateUrl, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = templateFilename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      message.error('匯出資料失敗')
    } finally {
      setDownloading(false)
    }
  }

  const runImport = async () => {
    if (!file) return
    setImporting(true)
    setResult(undefined)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await apiClient.post<ImportResult>(importUrl, formData)
      setResult(res.data)
      if (res.data.errors.length === 0) {
        message.success(`匯入完成，成功 ${res.data.successCount} 筆`)
        setFile(undefined)
      }
    } catch (err) {
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? '匯入失敗')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div style={{ padding: 8 }}>
      <div style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>{description}</div>

      <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>匯出視窗</div>
        <Button icon={<DownloadOutlined />} loading={downloading} onClick={downloadTemplate}>
          匯出資料
        </Button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>匯入視窗</div>
        <Space wrap>
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
        {result && (
          <div style={{ marginTop: 16 }}>
            {result.errors.length === 0 ? (
              <Alert type="success" showIcon message={`匯入完成，成功 ${result.successCount} 筆`} />
            ) : (
              <Alert
                type="error"
                showIcon
                message={`匯入完成，成功 ${result.successCount} 筆，失敗 ${result.errors.length} 筆`}
                description={
                  <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                    {result.errors.map((e, i) => (
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
    </div>
  )
}

export default function BatchImport() {
  const navigate = useNavigate()

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
          <span style={{ fontSize: 18, fontWeight: 600 }}>多客戶班表匯入</span>
        </Space>
      </div>
      <div style={{ padding: 24 }}>
        <div style={{ background: '#fff', borderRadius: 8, padding: 16 }}>
          <Tabs
            items={[
              {
                key: 'company-schedule',
                label: '客戶／班表',
                children: (
                  <BatchImportPanel
                    description="一次匯出/匯入系統裡全部客戶的客戶基本資料與班表主檔。匯入範本=目前所有客戶的現況資料，可直接下載後編輯再上傳；每一列各自獨立驗證，某幾列有誤不會影響其他正確列的寫入。"
                    templateUrl="/admin/batch-import/company-schedule/template"
                    templateFilename="客戶與班表匯入表.xlsx"
                    importUrl="/admin/batch-import/company-schedule"
                  />
                ),
              },
              {
                key: 'leave-type-work-overtime',
                label: '假別／加班別',
                children: (
                  <BatchImportPanel
                    description="一次匯出/匯入系統裡全部客戶的假別主檔與加班別主檔。角色代碼/性別條件欄位請填「無特殊角色/年假/補休/生理假」「限男性/限女性/不限」等中文標籤(比照匯出範本的既有寫法)，不是原始代碼。"
                    templateUrl="/admin/batch-import/leave-type-work-overtime/template"
                    templateFilename="假別與加班別匯入表.xlsx"
                    importUrl="/admin/batch-import/leave-type-work-overtime"
                  />
                ),
              },
            ]}
          />
        </div>
      </div>
    </Layout>
  )
}
