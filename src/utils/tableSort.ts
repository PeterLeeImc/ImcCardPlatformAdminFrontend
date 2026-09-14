/**
 * antd Table的sorter只需要實作「遞增」比較邏輯，遞減由antd自動把結果反相處理，
 * 這裡的每個比較函式都只回傳遞增順序的結果。null/undefined一律視為「最小」，
 * 統一排在遞增排序的最前面，避免每個欄位各自決定null要放前面還是後面而不一致。
 */

export function compareStrings(a: string | null | undefined, b: string | null | undefined): number {
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1
  return a.localeCompare(b)
}

export function compareNumbers(a: number | null | undefined, b: number | null | undefined): number {
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1
  return a - b
}

/** 給ISO日期/日期時間字串(如"2026-01-01"、"2026-01-01T08:00:00")用；non-date字串會被Date解析成Invalid Date(NaN)，一律當作null處理。 */
export function compareDates(a: string | null | undefined, b: string | null | undefined): number {
  const ta = a == null ? NaN : new Date(a).getTime()
  const tb = b == null ? NaN : new Date(b).getTime()
  const va = Number.isNaN(ta) ? null : ta
  const vb = Number.isNaN(tb) ? null : tb
  return compareNumbers(va, vb)
}

export function compareBooleans(a: boolean | null | undefined, b: boolean | null | undefined): number {
  return compareNumbers(a == null ? null : a ? 1 : 0, b == null ? null : b ? 1 : 0)
}

/** 欄位顯示的是數字加單位/純數字字串(例如"8.5"、"8.5小時")，取字串開頭的數字部分排序；抓不到數字就當null。 */
export function compareNumericLabels(a: string | null | undefined, b: string | null | undefined): number {
  const parse = (v: string | null | undefined) => {
    if (v == null) return null
    const m = v.match(/-?\d+(\.\d+)?/)
    return m ? parseFloat(m[0]) : null
  }
  return compareNumbers(parse(a), parse(b))
}
