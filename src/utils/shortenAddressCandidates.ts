/**
 * 依序砍掉地址尾端的樓層/門牌/巷弄/段等細節，回傳由細到粗的候選地址清單。
 * 例如"台南市東區東門路二段297號13樓-1"查不到座標時，依序改試"...13樓"、"...297號"、
 * "...二段"，用來讓查無座標時能自動退而求其次找到大致位置。
 */
export function shortenAddressCandidates(addr: string): string[] {
  const candidates = [addr]
  let current = addr
  const patterns = [
    /[之\-][\d]+$/, // 之1或-1(樓層房號後綴，如10樓之1、13樓-1，兩種標示法都要能剝除)
    /[\d]+[樓層]$/, // 13樓/13層
    /[\d]+室$/, // X室
    /[\d]+號$/, // 297號
    /[\d]+弄$/, // X弄
    /[\d]+巷$/, // X巷
    /[〇零一二三四五六七八九十百千\d]+段$/, // 二段
  ]
  // 每輪只套用第一個命中的pattern就重新開始，讓"-1""13樓""297號"這類疊加的尾端單位能逐一剝除，
  // 而不是每個pattern只各自套用一次(否則"-1"擋住後面的"樓"pattern永遠match不到)。
  let changed = true
  while (changed) {
    changed = false
    for (const pattern of patterns) {
      const next = current.replace(pattern, '').trim()
      if (next !== current && next.length > 0) {
        candidates.push(next)
        current = next
        changed = true
        break
      }
    }
  }
  return candidates
}
