export type AccountType = 'cash' | 'bank' | 'credit_card' | 'investment' | 'loan'
export type TxType = 'income' | 'expense' | 'transfer'

export interface Account {
  id: string
  name: string
  institution: string
  type: AccountType
  /** Balance before the first transaction. Liabilities are negative. */
  openingBalance: number
  archived: boolean
  updatedAt: string
}

export interface Category {
  id: string
  name: string
  kind: 'income' | 'expense'
  /** lucide icon name, see components/CategoryIcon */
  icon: string
  color: string
}

export interface Transaction {
  id: string
  type: TxType
  date: string // YYYY-MM-DD
  /** Always positive. Direction comes from `type`. */
  amount: number
  description: string
  categoryId: string | null
  accountId: string
  toAccountId?: string
  notes?: string
  merchant?: string
  tags?: string[]
}

export interface Plan {
  monthlySalary: number
  annualBonus: number
  /** Overall monthly spending limit. 0 = use the sum of category budgets. */
  monthlyBudget: number
  savingsTargetRate: number
}

export interface Budget {
  id: string
  /** YYYY-MM for a single month, or 'all' for a recurring monthly budget. */
  month: string
  categoryId: string
  amount: number
}

export type BillFrequency = 'weekly' | 'monthly' | 'yearly'

/** A recurring payment. Nothing is recorded until the user taps "Paid". */
export interface Bill {
  id: string
  name: string
  amount: number
  categoryId: string
  accountId: string
  frequency: BillFrequency
  /** YYYY-MM-DD of the next payment. */
  nextDue: string
  /** Day of month to keep for monthly/yearly bills (so 31 -> 28 -> 31 does not drift). */
  day: number
}

/** A savings goal; the user adds money by hand (it does not touch accounts). */
export interface Goal {
  id: string
  name: string
  target: number
  saved: number
  /** YYYY-MM-DD, optional. */
  deadline?: string
  createdAt: string
}

export interface FinancialSnapshot {
  date: string
  assets: number
  liabilities: number
  netWorth: number
}

export interface Insight {
  id: string
  tone: 'positive' | 'warning' | 'info'
  text: string
  source: string
  link?: string
}

export interface Settings {
  name: string
  currency: 'VND'
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
  numberFormat: 'full' | 'compact'
  theme: 'light' | 'dark' | 'pink' | 'system'
  density: 'comfortable' | 'compact'
}

export interface Prefs {
  lastAccountId: Partial<Record<TxType, string>>
  lastCategoryId: Partial<Record<TxType, string>>
}

export interface AppData {
  version: number
  isDemo: boolean
  settings: Settings
  prefs: Prefs
  plan: Plan
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  budgets: Budget[]
  bills: Bill[]
  goals: Goal[]
  dismissedInsights: string[]
}
