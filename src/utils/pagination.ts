/**
 * 分頁列表共用的「每頁筆數」選項：10/20/全部。「全部」不是真的無上限，是送一個遠大於實際資料量的
 * size給後端分頁查詢，讓後端把所有符合條件的資料一次全部塞進同一頁回傳，不用另外改後端API。
 */
export const ALL_PAGE_SIZE = 100000

export const PAGE_SIZE_OPTIONS = [
  { value: 10, label: '每頁10筆' },
  { value: 20, label: '每頁20筆' },
  { value: ALL_PAGE_SIZE, label: '全部顯示' },
]
