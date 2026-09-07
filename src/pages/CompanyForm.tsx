import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Form, Input, InputNumber, Layout, Select, Space, Spin, message } from 'antd'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { apiClient } from '../api/client'
import type { CompanyCreateRequest, CompanyDetail, CompanyUpdateRequest } from '../types'
import { PUNCH_METHOD_OPTIONS } from '../types'
import { formatDateTime } from '../utils/formatDateTime'
import { shortenAddressCandidates } from '../utils/shortenAddressCandidates'

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

interface CompanyFormValues {
  companyNum: string
  chName: string
  name4Short: string
  addr: string
  punchMethod: string
  gpsRadiusMeters: number
}

/**
 * 地圖視角跟著pendingPosition/savedPosition移動：react-leaflet的MapContainer的center prop
 * 只在初次掛載時生效，之後改變不會自動移動視角，地址轉座標查到新位置、或套用/清除pending座標時，
 * 都要靠這個元件手動呼叫map.setView()把視角帶過去，否則新標出的紅點可能在畫面外看不到。
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

/**
 * 地圖點選座標分兩步驟(先在地圖上點選、暫存成「待套用」的紅點，按「套用地圖座標」才真的寫進表單欄位)，
 * 不是點一下就直接存，比照ZK CompanyDetailCtrl既有的設計(避免地圖拖曳/點擊事件連續觸發時
 * 座標值不穩定跳動的既有已知問題)。
 */
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

export default function CompanyForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const [form] = Form.useForm<CompanyFormValues>()
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [savedPosition, setSavedPosition] = useState<[number, number] | null>(null)
  const [pendingPosition, setPendingPosition] = useState<[number, number] | null>(null)
  const [detail, setDetail] = useState<CompanyDetail>()

  useEffect(() => {
    if (!isEdit) return
    setLoading(true)
    apiClient
      .get<CompanyDetail>(`/admin/companies/${id}`)
      .then((res) => {
        const d = res.data
        setDetail(d)
        form.setFieldsValue({
          companyNum: d.companyNum,
          chName: d.chName,
          name4Short: d.name4Short,
          addr: d.addr ?? '',
          punchMethod: d.punchMethod ?? 'GPS',
          gpsRadiusMeters: d.gpsRadiusMeters ?? 200,
        })
        if (d.latitude != null && d.longitude != null) {
          setSavedPosition([d.latitude, d.longitude])
        }
      })
      .catch((err) => {
        const axiosErr = err as { response?: { data?: string } }
        message.error(axiosErr.response?.data ?? '載入客戶資料失敗')
      })
      .finally(() => setLoading(false))
  }, [id, isEdit, form])

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

  const onFinish = async (values: CompanyFormValues) => {
    setSubmitting(true)
    try {
      const base = {
        chName: values.chName,
        name4Short: values.name4Short,
        addr: values.addr || undefined,
        latitude: savedPosition?.[0],
        longitude: savedPosition?.[1],
        punchMethod: values.punchMethod,
        gpsRadiusMeters: values.gpsRadiusMeters,
      }
      if (isEdit) {
        const body: CompanyUpdateRequest = base
        await apiClient.put(`/admin/companies/${id}`, body)
        message.success('已更新客戶')
      } else {
        const body: CompanyCreateRequest = { ...base, companyNum: values.companyNum }
        await apiClient.post('/admin/companies', body)
        message.success('已新增客戶')
      }
      navigate('/companies')
    } catch (err) {
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? (isEdit ? '更新失敗' : '新增失敗'))
    } finally {
      setSubmitting(false)
    }
  }

  const mapCenter = pendingPosition ?? savedPosition ?? DEFAULT_CENTER

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
          <a onClick={() => navigate('/companies')}>客戶維護</a>
          <span style={{ fontSize: 18, fontWeight: 600 }}>{isEdit ? '編輯客戶' : '新增客戶'}</span>
        </Space>
        {isEdit && <a onClick={() => navigate(`/dispatch-cases?companyId=${id}`)}>前往個案維護 / 班表 →</a>}
      </div>
      <div style={{ maxWidth: 720, margin: '32px auto', width: '100%', background: '#fff', borderRadius: 12, padding: 32 }}>
        <Spin spinning={loading}>
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            initialValues={{ punchMethod: 'GPS', gpsRadiusMeters: 200 }}
          >
            {isEdit ? (
              <Form.Item label="客戶編號" tooltip="IMC客戶編號">
                <Input value={detail?.companyNum} disabled />
              </Form.Item>
            ) : (
              <Form.Item
                name="companyNum"
                label="客戶編號"
                tooltip="IMC客戶編號"
                rules={[{ required: true, message: '請輸入客戶編號' }]}
              >
                <Input placeholder="客戶編號" />
              </Form.Item>
            )}
            <Form.Item name="chName" label="中文名稱" rules={[{ required: true, message: '請輸入中文名稱' }]}>
              <Input placeholder="中文名稱" />
            </Form.Item>
            <Form.Item name="name4Short" label="客戶簡稱" rules={[{ required: true, message: '請輸入客戶簡稱' }]}>
              <Input placeholder="客戶簡稱" />
            </Form.Item>
            <Form.Item label="地址">
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
              <MapContainer center={mapCenter} zoom={savedPosition || pendingPosition ? 16 : 7} style={{ height: 300, width: '100%' }}>
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
            {isEdit && detail && (
              <div style={{ marginBottom: 16, fontSize: 12, color: '#999' }}>
                建立時間：{formatDateTime(detail.createdAt)}　建立者：{detail.createdBy ?? '-'}　異動時間：
                {formatDateTime(detail.updatedAt)}　異動者：{detail.updatedBy ?? '-'}
              </div>
            )}
            <Form.Item style={{ marginBottom: 0 }}>
              <Space>
                <Button type="primary" htmlType="submit" loading={submitting}>
                  儲存
                </Button>
                <Button onClick={() => navigate('/companies')}>取消</Button>
              </Space>
            </Form.Item>
          </Form>
        </Spin>
      </div>
    </Layout>
  )
}
