/** 後端純日期欄位一律回傳yyyy-MM-dd(無時間/時區)，這裡單純字串轉換成yyyy/MM/dd顯示，不經過Date物件。 */
export function formatDate(day: string | null | undefined): string {
  if (!day) return '-'
  return day.replace(/-/g, '/')
}
