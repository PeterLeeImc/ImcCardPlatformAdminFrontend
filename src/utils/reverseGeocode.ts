/**
 * 依座標查詢「大約位置」，盡量細到門牌/場所：縣市+行政區+路/街+門牌號(OpenStreetMap有登錄才有)，
 * 附近有登錄的場所(公司/大樓/車站等)名稱以括號補在後面；查不到門牌就只到路名，再查不到就退到行政區/縣市。
 * 座標本身是定位當下最近的一個OSM登錄點，手機GPS通常有10~50公尺誤差，所以門牌/場所名稱只是
 * 「附近」的參考，不保證就是打卡當下站的那一戶。打Nominatim公開API(座標查地址)。
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { 'Accept-Language': 'zh-TW' } },
    )
    const data = (await res.json()) as {
      display_name?: string
      name?: string
      address?: Record<string, string>
    }
    const addr = data.address
    if (!addr) return null
    const city = addr.city ?? addr.town ?? addr.county ?? ''
    const district = addr.suburb ?? addr.city_district ?? addr.district ?? ''
    const road = addr.road ?? addr.pedestrian ?? addr.neighbourhood ?? ''
    const houseNumber = road && addr.house_number ? (/^\d+(-\d+)?$/.test(addr.house_number) ? `${addr.house_number}號` : addr.house_number) : ''
    const place = data.name && data.name !== road ? data.name : ''
    const approx = `${city}${district}${road}${houseNumber}${place ? `(${place})` : ''}`
    return approx || data.display_name || null
  } catch {
    return null
  }
}
