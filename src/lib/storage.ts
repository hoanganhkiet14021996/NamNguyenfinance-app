import { DATA_VERSION } from '../data/demo'
import { demoPlan, emptyPlan } from '../data/settings'
import type { AppData } from '../types'

const KEY = 'personal-cfo.v1'

/** Single seam for persistence: swap these two functions to add a backend later. */
export function loadData(): AppData | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    let data = JSON.parse(raw) as AppData
    if (data.version === 1) {
      data = {
        ...data,
        version: 2,
        plan: data.isDemo ? { ...demoPlan } : { ...emptyPlan },
        budgets: data.budgets.map((b) => ({ ...b, month: 'all' })),
      }
    }
    return data.version === DATA_VERSION ? data : null
  } catch {
    return null
  }
}

export function saveData(data: AppData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // storage full or unavailable: keep working in memory
  }
}
