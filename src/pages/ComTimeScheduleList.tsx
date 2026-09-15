import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Form, Input, InputNumber, Layout, Modal, Select, Space, Switch, Table, message } from 'antd'
import { CopyOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { ColumnsType } from 'antd/es/table'
import { apiClient } from '../api/client'
import type { CompanyListItem, ComTimeScheduleItem, ComTimeScheduleUpsertRequest, DispatchCaseItem, LogPage } from '../types'
import { PUNCH_METHOD_OPTIONS } from '../types'
import { shortenAddressCandidates } from '../utils/shortenAddressCandidates'
import { formatDateTime } from '../utils/formatDateTime'
import { compareNumbers, compareStrings } from '../utils/tableSort'
import PageHeader from '../components/PageHeader'
import ActionIcon from '../components/ActionIcon'

const DEFAULT_CENTER: [number, number] = [23.9739, 120.9797] // 台灣中心點，還沒有座標時的預設地圖中心

function dotIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}
const savedIcon = dotIcon('#1677ff')
const pendingIcon = dotIcon('#ff4d4f')

/**
 * 地圖視角跟著pendingPosition/savedPosition移動：react-leaflet的MapContainer的center prop
 * 只在初次掛載時生效，之後改變不會自動移動視角，地址轉座標查到新位置時要靠這個元件手動呼叫
 * map.setView()把視角帶過去，否則新標出的紅點可能在畫面外看不到。
 */
function MapFlyTo({ position }: { position: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (position) {
      map.setView(position, Math.max(map.getZoom(), 16))
    }
  }, [position, map])
  return null
}

function LocationPicker({
  savedPosition,
  pendingPosition,
  onPick,
}: {
  savedPosition: [number, number] | null
  pendingPosition: [number, number] | null
  onPick: (lat: number, lng: number) => void
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return (
    <>
      {savedPosition && <Marker position={savedPosition} icon={savedIcon} />}
      {pendingPosition && <Marker position={pendingPosition} icon={pendingIcon} />}
    </>
  )
}

interface ScheduleFormValues {
  workType: string
  onTime?: string
  offTime?: string
  noonBreakStartTime?: string
  noonBreakEndTime?: string
  useCustomLocation: boolean
  addr?: string
  punchMethod?: string
  gpsRadiusMeters?: number
  descr?: string
}

export default function ComTimeScheduleList() {
  // 客戶/個案選擇直接以查詢字串為唯一資料來源，比照員工維護的做法，離開頁面再回來時篩選狀態還在。
  const [searchParams, setSearchParams] = useSearchParams()
  const companyId = searchParams.get('companyId') ? Number(searchParams.get('companyId')) : undefined
  const dispatchCaseId = searchParams.get('dispatchCaseId') ? Number(searchParams.get('dispatchCaseId')) : undefined
  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [dispatchCases, setDispatchCases] = useState<DispatchCaseItem[]>([])
  const [rows, setRows] = useState<ComTimeScheduleItem[]>([])
  const [loading, setLoading] = useState(false)
  const [copyingFromTemplate, setCopyingFromTemplate] = useState(false)
  const [editing, setEditing] = useState<ComTimeScheduleItem | 'new'>()
  const [saving, setSaving] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [savedPosition, setSavedPosition] = useState<[number, number] | null>(null)
  const [pendingPosition, setPendingPosition] = useState<[number, number] | null>(null)
  const [useCustomLocation, setUseCustomLocation] = useState(false)
  const [form] = Form.useForm<ScheduleFormValues>()

  const templateCompany = companies.find((c) => c.template)
  const canCopyFromTemplate = !!templateCompany && !!companyId && templateCompany.id !== companyId

  const basePath = `/admin/companies/${companyId}/dispatch-cases/${dispatchCaseId}/time-schedules`

  useEffect(() => {
    apiClient
      .get<LogPage<CompanyListItem>>('/admin/companies', { params: { page: 0, size: 200 } })
      .then((res) => {
        setCompanies(res.data.content)
        if (companyId && res.data.content.some((c) => c.id === companyId)) {
          return
        }
        if (res.data.content.length > 0) {
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev)
              next.set('companyId', String(res.data.content[0].id))
              next.delete('dispatchCaseId')
              return next
            },
            { replace: true },
          )
        }
      })
      .catch(() => message.error('載入客戶清單失敗'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!companyId) return
    apiClient
      .get<DispatchCaseItem[]>(`/admin/companies/${companyId}/dispatch-cases`)
      .then((res) => {
        setDispatchCases(res.data)
        if (dispatchCaseId && res.data.some((d) => d.id === dispatchCaseId)) {
          return
        }
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            if (res.data.length > 0) {
              next.set('dispatchCaseId', String(res.data[0].id))
            } else {
              next.delete('dispatchCaseId')
            }
            return next
          },
          { replace: true },
        )
      })
      .catch(() => setDispatchCases([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  const fetchRows = () => {
    if (!companyId || !dispatchCaseId) {
      setRows([])
      return
    }
    setLoading(true)
    apiClient
      .get<ComTimeScheduleItem[]>(basePath)
      .then((res) => setRows(res.data))
      .catch((err) => {
        const axiosErr = err as { response?: { data?: string } }
        message.error(axiosErr.response?.data ?? '載入班表清單失敗')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, dispatchCaseId])

  const changeCompany = (v: number | undefined) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (v) {
          next.set('companyId', String(v))
        } else {
          next.delete('companyId')
        }
        next.delete('dispatchCaseId')
        return next
      },
      { replace: true },
    )
  }

  const changeDispatchCase = (v: number | undefined) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (v) {
          next.set('dispatchCaseId', String(v))
        } else {
          next.delete('dispatchCaseId')
        }
        return next
      },
      { replace: true },
    )
  }

  const copyFromTemplate = () => {
    if (!templateCompany || !companyId || !dispatchCaseId) return
    Modal.confirm({
      title: '確定要從樣板客戶的個案複製班表？',
      content: `樣板客戶：${templateCompany.chName}，同班別代碼的班表不會重複複製，複製後可自行修改。`,
      onOk: async () => {
        setCopyingFromTemplate(true)
        try {
          const res = await apiClient.post<{ copied: number }>(`${basePath}/copy-from-template`)
          message.success(`已複製 ${res.data.copied} 筆班表`)
          fetchRows()
        } catch (err) {
          const axiosErr = err as { response?: { data?: string } }
          message.error(axiosErr.response?.data ?? '複製失敗')
        } finally {
          setCopyingFromTemplate(false)
        }
      },
    })
  }

  const openEdit = (row: ComTimeScheduleItem | 'new') => {
    setEditing(row)
    setPendingPosition(null)
    if (row === 'new') {
      form.resetFields()
      setUseCustomLocation(false)
      setSavedPosition(null)
    } else {
      form.setFieldsValue({
        workType: row.workType,
        onTime: row.onTime ?? undefined,
        offTime: row.offTime ?? undefined,
        noonBreakStartTime: row.noonBreakStartTime ?? undefined,
        noonBreakEndTime: row.noonBreakEndTime ?? undefined,
        useCustomLocation: row.useCustomLocation,
        addr: row.addr ?? undefined,
        punchMethod: row.punchMethod ?? 'GPS',
        gpsRadiusMeters: row.gpsRadiusMeters ?? 200,
        descr: row.descr ?? undefined,
      })
      setUseCustomLocation(row.useCustomLocation)
      setSavedPosition(row.latitude != null && row.longitude != null ? [row.latitude, row.longitude] : null)
    }
  }

  const applyPendingPosition = () => {
    if (pendingPosition) {
      setSavedPosition(pendingPosition)
      setPendingPosition(null)
    }
  }

  const geocodeAddress = async () => {
    const addr = form.getFieldValue('addr') as string
    if (!addr || !addr.trim()) {
      message.warning('請先輸入地址')
      return
    }
    setGeocoding(true)
    try {
      const candidates = shortenAddressCandidates(addr.trim())
      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i]
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(candidate)}`,
          { headers: { 'Accept-Language': 'zh-TW' } },
        )
        const results = (await res.json()) as { lat: string; lon: string }[]
        if (results.length > 0) {
          setPendingPosition([parseFloat(results[0].lat), parseFloat(results[0].lon)])
          if (i === 0) {
            message.success('已在地圖上標出查詢到的位置，請確認後按「套用地圖座標」')
          } else {
            message.warning(
              `完整地址查無座標，已改用「${candidate}」查到附近位置，請在地圖上微調後按「套用地圖座標」`,
            )
          }
          return
        }
      }
      message.warning('查無這個地址附近的座標，請改用地圖手動點選')
    } catch {
      message.error('地址轉座標查詢失敗，請改用地圖手動點選')
    } finally {
      setGeocoding(false)
    }
  }

  const submitEdit = async () => {
    if (!editing || !companyId || !dispatchCaseId) return
    try {
      const values = await form.validateFields()
      const body: ComTimeScheduleUpsertRequest = {
        workType: values.workType,
        onTime: values.onTime,
        offTime: values.offTime,
        noonBreakStartTime: values.noonBreakStartTime,
        noonBreakEndTime: values.noonBreakEndTime,
        useCustomLocation: values.useCustomLocation,
        addr: values.useCustomLocation ? values.addr : undefined,
        latitude: values.useCustomLocation ? savedPosition?.[0] : undefined,
        longitude: values.useCustomLocation ? savedPosition?.[1] : undefined,
        punchMethod: values.useCustomLocation ? values.punchMethod : undefined,
        gpsRadiusMeters: values.useCustomLocation ? values.gpsRadiusMeters : undefined,
        descr: values.descr,
      }
      setSaving(true)
      if (editing === 'new') {
        await apiClient.post(basePath, body)
        message.success('已新增班表')
      } else {
        await apiClient.put(`${basePath}/${editing.id}`, body)
        message.success('已更新班表')
      }
      setEditing(undefined)
      fetchRows()
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  const [copying, setCopying] = useState<number>()

  /**
   * 複製這筆班表：新班別編號="原代碼-N"，N從1開始依序遞增，跳過已經存在的代碼(例如已經有
   * "日班-1"就改試"日班-2")，其餘欄位(時間/工作地點設定)原樣複製，不彈窗確認、點了就直接建立。
   */
  const handleCopy = async (row: ComTimeScheduleItem) => {
    const existingCodes = new Set(rows.map((r) => r.workType))
    let n = 1
    let newWorkType = `${row.workType}-${n}`
    while (existingCodes.has(newWorkType)) {
      n += 1
      newWorkType = `${row.workType}-${n}`
    }
    setCopying(row.id)
    try {
      const body: ComTimeScheduleUpsertRequest = {
        workType: newWorkType,
        onTime: row.onTime ?? undefined,
        offTime: row.offTime ?? undefined,
        noonBreakStartTime: row.noonBreakStartTime ?? undefined,
        noonBreakEndTime: row.noonBreakEndTime ?? undefined,
        useCustomLocation: row.useCustomLocation,
        addr: row.addr ?? undefined,
        latitude: row.latitude ?? undefined,
        longitude: row.longitude ?? undefined,
        punchMethod: row.punchMethod ?? undefined,
        gpsRadiusMeters: row.gpsRadiusMeters ?? undefined,
        descr: row.descr ?? undefined,
      }
      await apiClient.post(basePath, body)
      message.success(`已複製為「${newWorkType}」`)
      fetchRows()
    } catch (err) {
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? '複製失敗')
    } finally {
      setCopying(undefined)
    }
  }

  const handleDelete = (row: ComTimeScheduleItem) => {
    Modal.confirm({
      title: '確定要刪除這個班表？',
      content: `班別編號：${row.workType}`,
      okType: 'danger',
      onOk: async () => {
        try {
          await apiClient.delete(`${basePath}/${row.id}`)
          message.success('刪除成功')
          fetchRows()
        } catch (err) {
          const axiosErr = err as { response?: { data?: string } }
          message.error(axiosErr.response?.data ?? '刪除失敗')
        }
      },
    })
  }

  const addrLabel = (record: ComTimeScheduleItem) =>
    record.useCustomLocation ? record.addr ?? '(未設定地址)' : '客戶預設地址'
  const punchMethodLabel = (record: ComTimeScheduleItem) =>
    record.useCustomLocation
      ? PUNCH_METHOD_OPTIONS.find((o) => o.value === record.punchMethod)?.label ?? record.punchMethod ?? '-'
      : '(依客戶設定)'

  const columns: ColumnsType<ComTimeScheduleItem> = [
    {
      title: '班別編號',
      dataIndex: 'workType',
      key: 'workType',
      sorter: (a, b) => compareStrings(a.workType, b.workType),
    },
    { title: '上班時間', dataIndex: 'onTime', key: 'onTime', sorter: (a, b) => compareStrings(a.onTime, b.onTime) },
    {
      title: '下班時間',
      dataIndex: 'offTime',
      key: 'offTime',
      sorter: (a, b) => compareStrings(a.offTime, b.offTime),
    },
    {
      title: '午休開始',
      dataIndex: 'noonBreakStartTime',
      key: 'noonBreakStartTime',
      sorter: (a, b) => compareStrings(a.noonBreakStartTime, b.noonBreakStartTime),
    },
    {
      title: '午休結束',
      dataIndex: 'noonBreakEndTime',
      key: 'noonBreakEndTime',
      sorter: (a, b) => compareStrings(a.noonBreakEndTime, b.noonBreakEndTime),
    },
    {
      title: '工作地點',
      key: 'addr',
      render: (_, record) => addrLabel(record),
      sorter: (a, b) => compareStrings(addrLabel(a), addrLabel(b)),
    },
    {
      title: '打卡方式',
      key: 'punchMethod',
      render: (_, record) => punchMethodLabel(record),
      sorter: (a, b) => compareStrings(punchMethodLabel(a), punchMethodLabel(b)),
    },
    {
      title: 'GPS打卡有效半徑(公尺)',
      key: 'gpsRadiusMeters',
      render: (_, record) => (record.useCustomLocation ? record.gpsRadiusMeters ?? '-' : '(依客戶設定)'),
      sorter: (a, b) =>
        compareNumbers(a.useCustomLocation ? a.gpsRadiusMeters : null, b.useCustomLocation ? b.gpsRadiusMeters : null),
    },
    {
      title: '備註',
      dataIndex: 'descr',
      key: 'descr',
      ellipsis: true,
      render: (v: string | null) => v ?? '-',
      sorter: (a, b) => compareStrings(a.descr, b.descr),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <ActionIcon title="編輯" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <ActionIcon
            title={copying === record.id ? '複製中...' : '複製'}
            icon={<CopyOutlined />}
            disabled={copying === record.id}
            onClick={() => handleCopy(record)}
          />
          <ActionIcon title="刪除" icon={<DeleteOutlined />} danger onClick={() => handleDelete(record)} />
        </Space>
      ),
    },
  ]

  const mapCenter = pendingPosition ?? savedPosition ?? DEFAULT_CENTER

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f6f8' }}>
      <PageHeader
        title="班表維護"
        actions={
          <Button type="primary" onClick={() => openEdit('new')} disabled={!dispatchCaseId}>
            新增班表
          </Button>
        }
      />
      <div style={{ padding: 24 }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <span>選擇客戶：</span>
          <Select
            style={{ width: 360 }}
            placeholder="選擇客戶"
            value={companyId}
            onChange={changeCompany}
            options={companies.map((c) => ({
              value: c.id,
              label: c.template ? `[樣板] ${c.companyNum} ${c.chName}` : `${c.companyNum} ${c.chName}`,
            }))}
          />
          <span>選擇個案：</span>
          <Select
            style={{ width: 200 }}
            placeholder={companyId ? '選擇個案' : '請先選擇客戶'}
            disabled={!companyId}
            value={dispatchCaseId}
            onChange={changeDispatchCase}
            options={dispatchCases.map((d) => ({ value: d.id, label: d.caseCode }))}
          />
          <Button onClick={copyFromTemplate} loading={copyingFromTemplate} disabled={!canCopyFromTemplate}>
            複製樣板客戶個案班表
          </Button>
        </Space>
        <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={false} />
      </div>
      <Modal
        title={editing === 'new' ? '新增班表' : '編輯班表'}
        open={!!editing}
        onCancel={() => setEditing(undefined)}
        onOk={submitEdit}
        confirmLoading={saving}
        destroyOnHidden
        width={680}
      >
        <Form form={form} layout="vertical" initialValues={{ useCustomLocation: false, punchMethod: 'GPS', gpsRadiusMeters: 200 }}>
          <Form.Item name="workType" label="班別編號" rules={[{ required: true, message: '請輸入班別編號' }]}>
            <Input placeholder="例如：A1" />
          </Form.Item>
          <Form.Item name="onTime" label="上班時間">
            <Input placeholder="例如：09:00" />
          </Form.Item>
          <Form.Item name="offTime" label="下班時間">
            <Input placeholder="例如：18:00" />
          </Form.Item>
          <Form.Item name="noonBreakStartTime" label="午休開始">
            <Input placeholder="例如：12:00" />
          </Form.Item>
          <Form.Item name="noonBreakEndTime" label="午休結束">
            <Input placeholder="例如：13:00" />
          </Form.Item>
          <Form.Item
            name="useCustomLocation"
            label="工作地點"
            valuePropName="checked"
            tooltip="有些客戶有多處工作地點需求：關閉時這個班別的員工打卡沿用客戶地址設定；開啟後可以另外設定這個班別專屬的打卡地點(例如夜班在廠區、日班在總部)"
          >
            <Switch checkedChildren="自訂工作地點" unCheckedChildren="使用客戶預設地址" onChange={setUseCustomLocation} />
          </Form.Item>
          {useCustomLocation && (
            <>
              <Form.Item label="工作地址">
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item name="addr" noStyle>
                    <Input placeholder="地址" />
                  </Form.Item>
                  <Button loading={geocoding} onClick={geocodeAddress}>
                    地址轉座標
                  </Button>
                </Space.Compact>
              </Form.Item>
              <Form.Item name="punchMethod" label="打卡方式">
                <Select options={PUNCH_METHOD_OPTIONS} />
              </Form.Item>
              <Form.Item name="gpsRadiusMeters" label="GPS打卡有效半徑(公尺)">
                <InputNumber min={1} style={{ width: 200 }} />
              </Form.Item>
              <Form.Item label="打卡地點座標">
                <div style={{ marginBottom: 8, fontSize: 13, color: '#666' }}>
                  在地圖上點選要設定的位置(紅點)，確認無誤後按「套用地圖座標」(藍點)才會真的儲存。
                  {savedPosition && (
                    <span>
                      　目前座標：{savedPosition[0].toFixed(6)}, {savedPosition[1].toFixed(6)}
                    </span>
                  )}
                </div>
                <MapContainer
                  center={mapCenter}
                  zoom={savedPosition || pendingPosition ? 16 : 7}
                  style={{ height: 260, width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <LocationPicker
                    savedPosition={savedPosition}
                    pendingPosition={pendingPosition}
                    onPick={(lat, lng) => setPendingPosition([lat, lng])}
                  />
                  <MapFlyTo position={pendingPosition ?? savedPosition} />
                </MapContainer>
                {pendingPosition && (
                  <div style={{ marginTop: 8 }}>
                    <Space>
                      <Button type="primary" onClick={applyPendingPosition}>
                        套用地圖座標
                      </Button>
                      <Button onClick={() => setPendingPosition(null)}>取消</Button>
                    </Space>
                  </div>
                )}
              </Form.Item>
            </>
          )}
          <Form.Item name="descr" label="備註">
            <Input.TextArea placeholder="備註" rows={3} />
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
