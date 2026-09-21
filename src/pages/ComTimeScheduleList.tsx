import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Form, Input, InputNumber, Layout, Modal, Radio, Select, Space, Switch, Table, Tag, message } from 'antd'
import { CopyOutlined, DeleteOutlined, EditOutlined, PlusOutlined, SyncOutlined } from '@ant-design/icons'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { ColumnsType } from 'antd/es/table'
import {
  apiClient,
  isAdvisorEditingTemplateCompany,
  resolveDefaultCompanyId,
  resolveDefaultDispatchCaseId,
  sortCompaniesTemplateLast,
} from '../api/client'
import type {
  CompanyListItem,
  ComTimeScheduleItem,
  ComTimeScheduleUpsertRequest,
  DispatchCaseItem,
  LogPage,
  ScheduleLocation,
} from '../types'
import { PUNCH_METHOD_OPTIONS } from '../types'
import { shortenAddressCandidates } from '../utils/shortenAddressCandidates'
import { formatDateTime } from '../utils/formatDateTime'
import { compareStrings } from '../utils/tableSort'
import PageHeader from '../components/PageHeader'
import ActionIcon from '../components/ActionIcon'
import ResultCount from '../components/ResultCount'
import PageSizeSelect from '../components/PageSizeSelect'

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
  punchMethod?: string
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
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(false)
  const [copyingFromTemplate, setCopyingFromTemplate] = useState(false)
  const [editing, setEditing] = useState<ComTimeScheduleItem | 'new'>()
  const [saving, setSaving] = useState(false)
  const [useCustomLocation, setUseCustomLocation] = useState(false)
  const [locations, setLocations] = useState<ScheduleLocation[]>([])
  const [form] = Form.useForm<ScheduleFormValues>()

  // 工作地點清單裡，正在新增/編輯的其中一筆地點(獨立的子表單+地圖，避免一次在畫面上疊多張地圖)。
  const [locationEditorOpen, setLocationEditorOpen] = useState(false)
  const [locationEditorIndex, setLocationEditorIndex] = useState<number | null>(null)
  const [locAddr, setLocAddr] = useState('')
  const [locGpsRadiusMeters, setLocGpsRadiusMeters] = useState(200)
  const [locEnforceGpsRadius, setLocEnforceGpsRadius] = useState(false)
  const [locSavedPosition, setLocSavedPosition] = useState<[number, number] | null>(null)
  const [locPendingPosition, setLocPendingPosition] = useState<[number, number] | null>(null)
  const [geocoding, setGeocoding] = useState(false)

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
        const defaultCompanyId = resolveDefaultCompanyId(res.data.content)
        if (defaultCompanyId) {
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev)
              next.set('companyId', String(defaultCompanyId))
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
        const defaultCaseId = resolveDefaultDispatchCaseId(res.data, companyId)
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            if (defaultCaseId) {
              next.set('dispatchCaseId', String(defaultCaseId))
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
      .then((res) => {
        setRows(res.data)
        setPage(0)
      })
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
    if (row === 'new') {
      form.resetFields()
      setUseCustomLocation(false)
      setLocations([])
    } else {
      form.setFieldsValue({
        workType: row.workType,
        onTime: row.onTime ?? undefined,
        offTime: row.offTime ?? undefined,
        noonBreakStartTime: row.noonBreakStartTime ?? undefined,
        noonBreakEndTime: row.noonBreakEndTime ?? undefined,
        useCustomLocation: row.useCustomLocation,
        punchMethod: row.punchMethod ?? 'GPS',
        descr: row.descr ?? undefined,
      })
      setUseCustomLocation(row.useCustomLocation)
      setLocations(row.locations ?? [])
    }
  }

  const openLocationEditor = (index?: number) => {
    if (index != null) {
      const loc = locations[index]
      setLocationEditorIndex(index)
      setLocAddr(loc.addr ?? '')
      setLocGpsRadiusMeters(loc.gpsRadiusMeters ?? 200)
      setLocEnforceGpsRadius(loc.enforceGpsRadius)
      setLocSavedPosition(loc.latitude != null && loc.longitude != null ? [loc.latitude, loc.longitude] : null)
    } else {
      setLocationEditorIndex(null)
      setLocAddr('')
      setLocGpsRadiusMeters(200)
      setLocEnforceGpsRadius(false)
      setLocSavedPosition(null)
    }
    setLocPendingPosition(null)
    setLocationEditorOpen(true)
  }

  const applyPendingPosition = () => {
    if (locPendingPosition) {
      setLocSavedPosition(locPendingPosition)
      setLocPendingPosition(null)
    }
  }

  const geocodeAddress = async () => {
    if (!locAddr.trim()) {
      message.warning('請先輸入地址')
      return
    }
    setGeocoding(true)
    try {
      const candidates = shortenAddressCandidates(locAddr.trim())
      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i]
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(candidate)}`,
          { headers: { 'Accept-Language': 'zh-TW' } },
        )
        const results = (await res.json()) as { lat: string; lon: string }[]
        if (results.length > 0) {
          setLocPendingPosition([parseFloat(results[0].lat), parseFloat(results[0].lon)])
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

  const saveLocationEditor = () => {
    if (!locSavedPosition) {
      message.error('請先在地圖上點選位置並套用座標')
      return
    }
    const entry: ScheduleLocation = {
      addr: locAddr.trim() || null,
      latitude: locSavedPosition[0],
      longitude: locSavedPosition[1],
      gpsRadiusMeters: locGpsRadiusMeters,
      enforceGpsRadius: locEnforceGpsRadius,
    }
    setLocations((prev) => {
      if (locationEditorIndex != null) {
        const next = [...prev]
        next[locationEditorIndex] = entry
        return next
      }
      return [...prev, entry]
    })
    setLocationEditorOpen(false)
  }

  const removeLocation = (index: number) => {
    setLocations((prev) => prev.filter((_, i) => i !== index))
  }

  const submitEdit = async () => {
    if (!editing || !companyId || !dispatchCaseId) return
    try {
      const values = await form.validateFields()
      if (values.useCustomLocation && locations.length === 0) {
        message.error('請至少新增一個工作地點')
        return
      }
      const body: ComTimeScheduleUpsertRequest = {
        workType: values.workType,
        onTime: values.onTime,
        offTime: values.offTime,
        noonBreakStartTime: values.noonBreakStartTime,
        noonBreakEndTime: values.noonBreakEndTime,
        useCustomLocation: values.useCustomLocation,
        locations: values.useCustomLocation ? locations : undefined,
        punchMethod: values.useCustomLocation ? values.punchMethod : undefined,
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
   * "日班-1"就改試"日班-2")，其餘欄位(時間/工作地點清單)原樣複製，不彈窗確認、點了就直接建立。
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
        locations: row.locations,
        punchMethod: row.punchMethod ?? undefined,
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

  const addrLabel = (record: ComTimeScheduleItem) => {
    if (!record.useCustomLocation) return '客戶預設地址'
    const count = record.locations?.length ?? 0
    if (count === 0) return '(未設定地址)'
    const first = record.locations[0].addr ?? '(未命名地點)'
    return count > 1 ? `${first} 等${count}處` : first
  }
  const punchMethodLabel = (record: ComTimeScheduleItem) =>
    record.useCustomLocation
      ? PUNCH_METHOD_OPTIONS.find((o) => o.value === record.punchMethod)?.label ?? record.punchMethod ?? '-'
      : '(依客戶設定)'

  const templateLocked = isAdvisorEditingTemplateCompany(companies, companyId)

  // 「同步員工班段」：只有員工班段配置採[標準班表]的個案才有意義(採每月提供排班的個案要靠人資自行排班)，
  // 即時觸發跟排程[標準班表自動排班]同一套邏輯，但只處理目前選擇的這個個案，不是全系統掃描。
  const selectedDispatchCase = dispatchCases.find((d) => d.id === dispatchCaseId)
  const canSyncEmployeeSchedule = selectedDispatchCase != null && !selectedDispatchCase.useCustomSchedule
  const [syncingSchedule, setSyncingSchedule] = useState(false)
  const syncEmployeeSchedule = async () => {
    if (!dispatchCaseId) return
    setSyncingSchedule(true)
    try {
      const res = await apiClient.post<string>(`${basePath}/sync-employee-schedule`)
      message.success(res.data)
    } catch (err) {
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? '同步失敗')
    } finally {
      setSyncingSchedule(false)
    }
  }

  const columns: ColumnsType<ComTimeScheduleItem> = [
    {
      title: '序號',
      key: 'seq',
      width: 60,
      render: (_, __, index) => page * pageSize + index + 1,
    },
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
          <ActionIcon title="編輯" icon={<EditOutlined />} disabled={templateLocked} onClick={() => openEdit(record)} />
          <ActionIcon
            title="刪除"
            icon={<DeleteOutlined />}
            danger
            disabled={templateLocked}
            onClick={() => handleDelete(record)}
          />
          <ActionIcon
            title={copying === record.id ? '複製中...' : '複製'}
            icon={<CopyOutlined />}
            disabled={templateLocked || copying === record.id}
            onClick={() => handleCopy(record)}
          />
          {canSyncEmployeeSchedule && (
            <ActionIcon
              title={syncingSchedule ? '同步中...' : '同步員工班段'}
              icon={<SyncOutlined />}
              disabled={templateLocked || syncingSchedule}
              onClick={syncEmployeeSchedule}
            />
          )}
        </Space>
      ),
    },
  ]

  const locationColumns: ColumnsType<ScheduleLocation> = [
    { title: '地址', dataIndex: 'addr', key: 'addr', render: (v: string | null) => v ?? '(未命名地點)' },
    {
      title: '座標',
      key: 'coord',
      render: (_, loc) =>
        loc.latitude != null && loc.longitude != null ? `${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}` : '-',
    },
    { title: '有效半徑(公尺)', dataIndex: 'gpsRadiusMeters', key: 'gpsRadiusMeters' },
    {
      title: '範圍外打卡',
      dataIndex: 'enforceGpsRadius',
      key: 'enforceGpsRadius',
      render: (v: boolean) => (v ? '不允許' : '允許'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, __, index) => (
        <Space size="small">
          <ActionIcon title="編輯" icon={<EditOutlined />} onClick={() => openLocationEditor(index)} />
          <ActionIcon title="刪除" icon={<DeleteOutlined />} danger onClick={() => removeLocation(index)} />
        </Space>
      ),
    },
  ]

  const locMapCenter = locPendingPosition ?? locSavedPosition ?? DEFAULT_CENTER

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
          <Space wrap>
            <span>選擇客戶：</span>
            <Select
              style={{ width: 360 }}
              placeholder="選擇客戶"
              value={companyId}
              onChange={changeCompany}
              options={sortCompaniesTemplateLast(companies).map((c) => ({
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
          rowKey="id"
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
        title={editing === 'new' ? '新增班表' : '編輯班表'}
        open={!!editing}
        onCancel={() => setEditing(undefined)}
        onOk={submitEdit}
        confirmLoading={saving}
        destroyOnHidden
        width={720}
      >
        <Form form={form} layout="vertical" initialValues={{ useCustomLocation: false, punchMethod: 'GPS' }}>
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
            tooltip="有些客戶有多處工作地點需求：關閉時這個班別的員工打卡沿用客戶地址設定；開啟後可以另外設定這個班別專屬的打卡地點清單(可以新增多筆，例如總部+分點，員工在任一處打卡都算有效)"
          >
            <Switch checkedChildren="自訂工作地點" unCheckedChildren="使用客戶預設地址" onChange={setUseCustomLocation} />
          </Form.Item>
          {useCustomLocation && (
            <>
              <Form.Item name="punchMethod" label="打卡方式">
                <Select options={PUNCH_METHOD_OPTIONS} />
              </Form.Item>
              <Form.Item label="工作地點清單">
                <Table
                  rowKey={(_, index) => index ?? 0}
                  size="small"
                  columns={locationColumns}
                  dataSource={locations}
                  pagination={false}
                  locale={{ emptyText: '尚未新增工作地點' }}
                />
                <Button
                  type="dashed"
                  block
                  icon={<PlusOutlined />}
                  style={{ marginTop: 8 }}
                  onClick={() => openLocationEditor()}
                >
                  新增工作地點
                </Button>
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

      <Modal
        title={locationEditorIndex != null ? '編輯工作地點' : '新增工作地點'}
        open={locationEditorOpen}
        onCancel={() => setLocationEditorOpen(false)}
        onOk={saveLocationEditor}
        destroyOnHidden
        width={600}
        zIndex={1100}
      >
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4, fontSize: 13 }}>地址</div>
          <Space.Compact style={{ width: '100%' }}>
            <Input placeholder="地址" value={locAddr} onChange={(e) => setLocAddr(e.target.value)} />
            <Button loading={geocoding} onClick={geocodeAddress}>
              地址轉座標
            </Button>
          </Space.Compact>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4, fontSize: 13 }}>GPS打卡有效半徑(公尺)</div>
          <InputNumber min={1} style={{ width: 200 }} value={locGpsRadiusMeters} onChange={(v) => setLocGpsRadiusMeters(v ?? 200)} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4, fontSize: 13 }}>打卡方圓範圍外可進行打卡</div>
          <Radio.Group
            value={locEnforceGpsRadius}
            onChange={(e) => setLocEnforceGpsRadius(e.target.value)}
            options={[
              { label: '允許', value: false },
              { label: '不允許', value: true },
            ]}
          />
        </div>
        <div style={{ marginBottom: 8, fontSize: 13, color: '#666' }}>
          在地圖上點選要設定的位置(紅點)，確認無誤後按「套用地圖座標」(藍點)才會真的儲存。
          {locSavedPosition && (
            <span>
              　目前座標：{locSavedPosition[0].toFixed(6)}, {locSavedPosition[1].toFixed(6)}
            </span>
          )}
        </div>
        <MapContainer center={locMapCenter} zoom={locSavedPosition || locPendingPosition ? 16 : 7} style={{ height: 260, width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationPicker
            savedPosition={locSavedPosition}
            pendingPosition={locPendingPosition}
            onPick={(lat, lng) => setLocPendingPosition([lat, lng])}
          />
          <MapFlyTo position={locPendingPosition ?? locSavedPosition} />
        </MapContainer>
        {locPendingPosition && (
          <div style={{ marginTop: 8 }}>
            <Space>
              <Button type="primary" onClick={applyPendingPosition}>
                套用地圖座標
              </Button>
              <Button onClick={() => setLocPendingPosition(null)}>取消</Button>
            </Space>
          </div>
        )}
        {!locSavedPosition && (
          <Tag color="warning" style={{ marginTop: 8 }}>
            尚未套用座標，無法儲存這個地點
          </Tag>
        )}
      </Modal>
    </Layout>
  )
}
