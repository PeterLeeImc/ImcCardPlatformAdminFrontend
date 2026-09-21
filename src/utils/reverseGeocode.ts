/**
 * 依座標查詢「大約位置」(縣市+行政區+路/街，查不到路名時退而求其次只顯示縣市+行政區)，
 * 用途是給定位資訊一個人看得懂的參考位置，不是完整地址(不含門牌號碼)。跟CompanyForm.tsx既有
 * 的正向地址查詢(shortenAddressCandidates)一樣打Nominatim公開API，只是方向相反(座標查地址)。
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=17&addressdetails=1`,
      { headers: { 'Accept-Language': 'zh-TW' } },
    )
    const data = (await res.json()) as {
      display_name?: string
      address?: Record<string, string>
    }
    const addr = data.address
    if (!addr) return null
    const city = addr.city ?? addr.town ?? addr.county ?? ''
    const district = addr.suburb ?? addr.city_district ?? addr.district ?? ''
    const road = addr.road ?? addr.pedestrian ?? addr.neighbourhood ?? ''
    const approx = `${city}${district}${road}`
    return approx || data.display_name || null
  } catch {
    return null
  }
}
