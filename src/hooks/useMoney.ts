import { useCallback } from 'react'
import { formatDate, formatMoney, type MoneyOptions } from '../lib/format'
import { useStore } from '../store/AppStore'

export function useMoney() {
  const mode = useStore().data.settings.numberFormat
  return useCallback((n: number, opts: MoneyOptions = {}) => formatMoney(n, { mode, ...opts }), [mode])
}

export function useDate() {
  const style = useStore().data.settings.dateFormat
  return useCallback((d: string) => formatDate(d, style), [style])
}
