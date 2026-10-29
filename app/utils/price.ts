/** 每张图片单价展示：null/0 显示“待确认”。 */
export function formatImagePrice(value: number | null | undefined) {
  return typeof value === 'number' && value > 0 ? `$${value.toFixed(3)} / 张` : '待确认'
}

/** 每百万 token 单价展示 */
export function formatTokenPrice(value: number | null | undefined) {
  return typeof value === 'number' ? `$${value.toFixed(2)} / 百万 tokens` : '—'
}
