import { format, parseISO } from 'date-fns'
import type { Settings } from '../types'

const grouped = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

function trim(n: number, digits: number) {
  return String(Number(n.toFixed(digits)))
}

export function compactNumber(abs: number) {
  if (abs >= 1e9) return `${trim(abs / 1e9, 2)}B`
  if (abs >= 1e6) return `${trim(abs / 1e6, 1)}M`
  if (abs >= 1e3) return `${trim(abs / 1e3, 0)}K`
  return grouped.format(abs)
}

export interface MoneyOptions {
  mode?: Settings['numberFormat']
  sign?: boolean
  symbol?: boolean
}

export function formatMoney(n: number, { mode = 'full', sign = false, symbol = true }: MoneyOptions = {}) {
  const abs = Math.abs(Math.round(n))
  const body = mode === 'compact' ? compactNumber(abs) : grouped.format(abs)
  const prefix = n < 0 ? '-' : sign && n > 0 ? '+' : ''
  return `${prefix}${body}${symbol ? ' ₫' : ''}`
}

export const num = (n: number) => grouped.format(Math.round(n))

export const axisMoney = (n: number) => formatMoney(n, { mode: 'compact', symbol: false })

export const pct = (ratio: number, digits = 1) => `${(ratio * 100).toFixed(digits)}%`

export function formatDate(date: string, style: Settings['dateFormat'] = 'DD/MM/YYYY') {
  const d = parseISO(date)
  if (style === 'MM/DD/YYYY') return format(d, 'MM/dd/yyyy')
  if (style === 'YYYY-MM-DD') return format(d, 'yyyy-MM-dd')
  return format(d, 'dd/MM/yyyy')
}

export const shortDate = (date: string) => format(parseISO(date), 'MMM d')
export const monthTitle = (month: string) => format(parseISO(`${month}-01`), 'MMMM yyyy')
export const shortMonth = (month: string) => format(parseISO(`${month}-01`), "MMM ''yy")

export const todayStr = () => format(new Date(), 'yyyy-MM-dd')
export const monthOfDate = (date: string) => date.slice(0, 7)

export function greeting(now = new Date()) {
  const h = now.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
