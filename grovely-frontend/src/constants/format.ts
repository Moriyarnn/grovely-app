function fits(s: string, maxChars: number): boolean {
  return !s.includes('e') && !s.includes('E') && s.length <= maxChars
}

export function clampNumber(value: number | string | null | undefined, maxChars: number): string {
  if (value == null || value === '') return ''
  const num = Number(value)
  if (!Number.isFinite(num)) return ''

  const natural = String(num)
  if (fits(natural, maxChars)) return natural

  for (let decimals = Math.max(0, maxChars - 2); decimals >= 0; decimals--) {
    const candidate = num.toFixed(decimals)
    if (fits(candidate, maxChars)) return candidate
  }
  return '9'.repeat(Math.max(1, maxChars - 1)) + '+'
}

export function clampPrice(value: number | string | null | undefined, maxChars: number, startDecimals = 2): string {
  if (value == null || value === '') return ''
  const num = Number(value)
  if (!Number.isFinite(num)) return ''

  for (let decimals = startDecimals; decimals >= 0; decimals--) {
    const candidate = num.toFixed(decimals)
    if (fits(candidate, maxChars)) return candidate
  }
  return '9'.repeat(Math.max(1, maxChars - 1)) + '+'
}

export function clampQty(amount: number | string | null | undefined, unit: string | null | undefined, totalBudget = 8): string {
  if (amount == null || amount === '') return ''
  const unitStr = unit ? ' ' + unit : ''
  const numBudget = Math.max(2, totalBudget - unitStr.length)
  return clampNumber(amount, numBudget) + unitStr
}

export function formatMonthDayRange(startDate: string, endDate?: string | null): string {
  const formatDate = (date: string) => new Date(date + 'T12:00:00')
    .toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  if (!endDate || endDate === startDate) return formatDate(startDate)
  return `${formatDate(startDate)} → ${formatDate(endDate)}`
}

export function formatPeriodDayType(excluded: boolean): string {
  return excluded ? 'Period day - Excluded from calculations' : 'Period day'
}
