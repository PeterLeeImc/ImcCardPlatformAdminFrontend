import type { ReactNode } from 'react'
import { Button, Tooltip } from 'antd'

/**
 * 清單「操作」欄用的圖示按鈕：文字說明改成滑鼠移過去才顯示的提示(tooltip)，避免像「個案維護/班表」
 * 「取消樣板」這種較長的中文字串堆在同一欄裡把欄位撐寬、甚至換行擠壓到其他欄位。
 */
export default function ActionIcon({
  title,
  icon,
  onClick,
  danger,
  disabled,
}: {
  title: string
  icon: ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <Tooltip title={title}>
      <Button
        type="text"
        size="middle"
        icon={<span style={{ fontSize: 18, display: 'inline-flex' }}>{icon}</span>}
        danger={danger}
        disabled={disabled}
        onClick={onClick}
      />
    </Tooltip>
  )
}
