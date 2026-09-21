import { useState } from 'react'
import { reverseGeocode } from '../utils/reverseGeocode'

/**
 * 表格內顯示「大約位置」用：預設只顯示一個連結，點了才真的打API查詢並改顯示結果，
 * 不在表格渲染當下就對每一列都打Nominatim(避免大量列同時查詢，觸發公開API的頻率限制)。
 */
export default function ApproxLocationLink({ latitude, longitude }: { latitude: number | null; longitude: number | null }) {
  const [text, setText] = useState<string>()
  const [loading, setLoading] = useState(false)

  if (latitude == null || longitude == null) {
    return <span>-</span>
  }
  if (text) {
    return <span style={{ fontSize: 12 }}>{text}</span>
  }

  const load = async () => {
    setLoading(true)
    const result = await reverseGeocode(latitude, longitude)
    setText(result ?? '查詢失敗')
    setLoading(false)
  }

  return (
    <a onClick={load} style={{ fontSize: 12 }}>
      {loading ? '查詢中...' : '查看大約位置'}
    </a>
  )
}
