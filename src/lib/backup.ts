import { DATA_VERSION } from '../data/demo'
import type { AppData } from '../types'
import { downloadFile } from './csv'

export function exportJson(data: AppData) {
  downloadFile(`namoney-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json')
}

export async function parseBackup(file: File): Promise<AppData> {
  const data = JSON.parse(await file.text())
  const ok =
    data &&
    (data.version === DATA_VERSION || data.version === 2) &&
    Array.isArray(data.accounts) &&
    Array.isArray(data.categories) &&
    Array.isArray(data.transactions) &&
    Array.isArray(data.budgets) &&
    data.settings &&
    data.plan
  if (!ok) throw new Error('This file is not a valid NAMONEY backup.')
  return { ...data, version: DATA_VERSION, isDemo: false, bills: data.bills ?? [], goals: data.goals ?? [], dismissedInsights: data.dismissedInsights ?? [] }
}
