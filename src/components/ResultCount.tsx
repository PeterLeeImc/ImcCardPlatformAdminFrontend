/** 查詢區塊最右邊的「查詢到XX筆」提示，跟分頁列表共用同一份文字/樣式，避免各頁面各寫一份不一致。 */
export default function ResultCount({ count }: { count: number | undefined }) {
  return <span style={{ color: '#666', whiteSpace: 'nowrap' }}>查詢到 {count ?? 0} 筆</span>
}
