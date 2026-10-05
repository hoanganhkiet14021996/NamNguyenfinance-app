import type { Plan, Prefs, Settings } from '../types'

export const defaultSettings: Settings = {
  name: 'Nam',
  currency: 'VND',
  dateFormat: 'DD/MM/YYYY',
  numberFormat: 'full',
  theme: 'dark',
  density: 'comfortable',
}

export const defaultPrefs: Prefs = { lastAccountId: {}, lastCategoryId: {} }

export const emptyPlan: Plan = { monthlySalary: 0, annualBonus: 0, monthlyBudget: 0, savingsTargetRate: 0.2 }
export const demoPlan: Plan = { monthlySalary: 60_000_000, annualBonus: 40_000_000, monthlyBudget: 40_000_000, savingsTargetRate: 0.3 }
