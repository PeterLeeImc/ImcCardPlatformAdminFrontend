import { Select } from 'antd'
import { PAGE_SIZE_OPTIONS } from '../utils/pagination'

/** 分頁列表共用的「每頁筆數」選擇器(10/20/全部)，跟ResultCount並排放在查詢區塊最右邊。 */
export default function PageSizeSelect({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <Select style={{ width: 110 }} value={value} onChange={onChange} options={PAGE_SIZE_OPTIONS} />
}
