/**
 * 把後端回傳的ISO 8601時間字串(例如"2026-09-07T05:40:41.876+00:00"，後端用UTC序列化
 * java.util.Date，這是Spring Boot/Jackson在沒有另外設定spring.jackson.time-zone時的預設行為)
 * 轉成使用者所在時區(瀏覽器本地時區，例如台灣UTC+8就會轉成"2026/09/07 13:40:41")的
 * "yyyy/MM/dd HH:mm:ss"顯示格式，24小時制。
 *
 * 這裡刻意透過Date物件轉換(不是直接解析字串數字)：後端存的是真正的UTC時間，"+00:00"這個
 * 時區標記是準確的，字串裡的時分秒數字本身不是使用者所在地的當地時間，一定要做時區換算，
 * 不能直接原樣拿字串上的數字顯示，否則會少算時區偏移量(例如台灣UTC+8會少8小時)。
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
