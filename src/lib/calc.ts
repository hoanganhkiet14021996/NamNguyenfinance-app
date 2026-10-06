import { addDays, addMonths, differenceInCalendarDays, endOfMonth, format, getDaysInMonth, parseISO, setDate, startOfMonth } from 'date-fns'
import type { Account, AccountType, Bill, BillFrequency, Budget, FinancialSnapshot, Goal, Plan, Transaction } from '../types'

export const ASSET_TYPES: AccountType[] = ['cash', 'bank', 'investment']
export const LIABILITY_TYPES: AccountType[] = ['credit_card', 'loan']
export const CASH_TYPES: AccountType[] = ['cash', 'bank']

export const isLiability = (a: Account) => LIABILITY_TYPES.includes(a.type)

/** Signed effect of a transaction on one account's balance. */
export function txEffect(tx: Transaction, accountId: string): number {
  if (tx.type === 'income') return tx.accountId === accountId ? tx.amount : 0
  if (tx.type === 'expense') return tx.accountId === accountId ? -tx.amount : 0
  let effect = 0
  if (tx.accountId === accountId) effect -= tx.amount
  if (tx.toAccountId === accountId) effect += tx.amount
  return effect
}

export function computeBalances(accounts: Account[], txs: Transaction[], asOf?: string) {
  const balances = new Map(accounts.map((a) => [a.id, a.openingBalance]))
  for (const tx of txs) {
    if (asOf && tx.date > asOf) continue
    if (tx.type === 'transfer') {
      if (balances.has(tx.accountId)) balances.set(tx.accountId, balances.get(tx.accountId)! - tx.amount)
      if (tx.toAccountId && balances.has(tx.toAccountId)) balances.set(tx.toAccountId, balances.get(tx.toAccountId)! + tx.amount)
    } else if (balances.has(tx.accountId)) {
      const sign = tx.type === 'income' ? 1 : -1
      balances.set(tx.accountId, balances.get(tx.accountId)! + sign * tx.amount)
    }
  }
  return balances
}

/** Balances at several ascending dates in one pass over the sorted transactions. */
export function balancesAtDates(accounts: Account[], txs: Transaction[], dates: string[]) {
  const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date))
  const running = new Map(accounts.map((a) => [a.id, a.openingBalance]))
  const result: Map<string, number>[] = []
  let i = 0
  for (const date of dates) {
    while (i < sorted.length && sorted[i].date <= date) {
      const tx = sorted[i++]
      for (const id of [tx.accountId, tx.toAccountId]) {
        if (id && running.has(id)) running.set(id, running.get(id)! + txEffect(tx, id))
      }
    }
    result.push(new Map(running))
  }
  return result
}

export function totalsFromBalances(accounts: Account[], balances: Map<string, number>) {
  let assets = 0
  let liabilities = 0
  let cash = 0
  for (const a of accounts) {
    if (a.archived) continue
    const b = balances.get(a.id) ?? 0
    if (isLiability(a)) liabilities += -b
    else assets += b
    if (CASH_TYPES.includes(a.type)) cash += b
  }
  return { assets, liabilities, cash, netWorth: assets - liabilities }
}

export function snapshotsAt(accounts: Account[], txs: Transaction[], dates: string[]): FinancialSnapshot[] {
  return balancesAtDates(accounts, txs, dates).map((balances, i) => {
    const t = totalsFromBalances(accounts, balances)
    return { date: dates[i], assets: t.assets, liabilities: t.liabilities, netWorth: t.netWorth }
  })
}

export const monthEnd = (month: string) => format(endOfMonth(parseISO(`${month}-01`)), 'yyyy-MM-dd')
export const shiftMonth = (month: string, delta: number) => format(addMonths(parseISO(`${month}-01`), delta), 'yyyy-MM')

export function monthRange(endMonth: string, count: number) {
  return Array.from({ length: count }, (_, i) => shiftMonth(endMonth, i - count + 1))
}

export function monthSummary(txs: Transaction[], month: string, untilDay?: number) {
  let income = 0
  let expenses = 0
  for (const t of txs) {
    if (t.type === 'transfer' || !t.date.startsWith(month)) continue
    if (untilDay && Number(t.date.slice(8)) > untilDay) continue
    if (t.type === 'income') income += t.amount
    else expenses += t.amount
  }
  const savings = income - expenses
  return { income, expenses, savings, savingsRate: income > 0 ? savings / income : null }
}

/** Average monthly expenses over the last three complete months (falls back to this month). */
export function monthlyBurn(txs: Transaction[], currentMonth: string) {
  const prior = monthRange(shiftMonth(currentMonth, -1), 3)
    .map((m) => monthSummary(txs, m).expenses)
    .filter((v) => v > 0)
  if (prior.length) return prior.reduce((s, v) => s + v, 0) / prior.length
  return monthSummary(txs, currentMonth).expenses
}

export const emergencyFundMonths = (cash: number, burn: number) => (burn > 0 ? cash / burn : null)
export const debtRatio = (liabilities: number, netWorth: number) => (netWorth > 0 ? liabilities / netWorth : null)

export function spendingByCategory(txs: Transaction[], from: string, to: string) {
  const map = new Map<string, number>()
  for (const t of txs) {
    if (t.type !== 'expense' || t.date < from || t.date > to) continue
    const key = t.categoryId ?? 'uncategorized'
    map.set(key, (map.get(key) ?? 0) + t.amount)
  }
  return [...map.entries()].map(([categoryId, amount]) => ({ categoryId, amount })).sort((a, b) => b.amount - a.amount)
}

/** Recurring ('all') budgets, overridden by any budget set for that specific month. */
export function budgetsForMonth(budgets: Budget[], month: string) {
  const byCategory = new Map<string, Budget>()
  for (const b of budgets) if (b.month === 'all') byCategory.set(b.categoryId, b)
  for (const b of budgets) if (b.month === month) byCategory.set(b.categoryId, b)
  return [...byCategory.values()]
}

export function budgetUsage(budget: Budget, txs: Transaction[], month: string) {
  const spent = txs
    .filter((t) => t.type === 'expense' && t.categoryId === budget.categoryId && t.date.startsWith(month))
    .reduce((s, t) => s + t.amount, 0)
  return { spent, remaining: budget.amount - spent, ratio: budget.amount > 0 ? spent / budget.amount : 0 }
}

/** Overall monthly limit: the explicit plan value, else the sum of category budgets. */
export function monthlyLimit(plan: Plan, budgets: Budget[], month: string) {
  if (plan.monthlyBudget > 0) return plan.monthlyBudget
  return budgetsForMonth(budgets, month).reduce((s, b) => s + b.amount, 0)
}

export type Granularity = 'monthly' | 'quarterly' | 'yearly'

export interface CashFlowPoint {
  key: string
  label: string
  income: number
  expenses: number
  net: number
}

export function cashFlowSeries(txs: Transaction[], granularity: Granularity, today: string): CashFlowPoint[] {
  const keyOf = (date: string) => {
    if (granularity === 'monthly') return date.slice(0, 7)
    if (granularity === 'yearly') return date.slice(0, 4)
    return `${date.slice(0, 4)}-Q${Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1}`
  }
  const labelOf = (key: string) => {
    if (granularity === 'monthly') return format(parseISO(`${key}-01`), 'MMM')
    return key.replace('-', ' ')
  }
  const currentKey = keyOf(today)
  const keys: string[] = []
  if (granularity === 'monthly') {
    keys.push(...monthRange(today.slice(0, 7), 12))
  } else if (granularity === 'quarterly') {
    let y = Number(today.slice(0, 4))
    let q = Math.floor((Number(today.slice(5, 7)) - 1) / 3) + 1
    for (let i = 0; i < 8; i++) {
      keys.unshift(`${y}-Q${q}`)
      if (--q === 0) {
        q = 4
        y--
      }
    }
  } else {
    const y = Number(today.slice(0, 4))
    for (let i = 4; i >= 0; i--) keys.push(String(y - i))
  }
  const map = new Map(keys.map((k) => [k, { key: k, label: labelOf(k), income: 0, expenses: 0, net: 0 }]))
  for (const t of txs) {
    if (t.type === 'transfer') continue
    const row = map.get(keyOf(t.date))
    if (!row) continue
    if (t.type === 'income') row.income += t.amount
    else row.expenses += t.amount
  }
  const firstKey = txs.length ? keyOf(txs.reduce((min, t) => (t.date < min ? t.date : min), today)) : currentKey
  return keys
    .filter((k) => k <= currentKey && k >= firstKey)
    .map((k) => {
      const row = map.get(k)!
      row.net = row.income - row.expenses
      return row
    })
}

export type NetWorthRange = '1M' | '3M' | '6M' | '1Y' | 'All'

export function netWorthDates(range: NetWorthRange, today: string, firstDate: string) {
  const dates: string[] = []
  if (range === '1M') {
    for (let i = 4; i >= 0; i--) dates.push(format(addDays(parseISO(today), -i * 7), 'yyyy-MM-dd'))
    return dates
  }
  const currentMonth = today.slice(0, 7)
  let count = range === '3M' ? 3 : range === '6M' ? 6 : range === '1Y' ? 12 : 0
  if (range === 'All') {
    const first = firstDate.slice(0, 7)
    while (shiftMonth(first, count) < currentMonth) count++
    count += 1
  }
  for (const m of monthRange(currentMonth, Math.max(count, 2))) {
    dates.push(m === currentMonth ? today : monthEnd(m))
  }
  return dates
}

/** The payment after `date`. Monthly/yearly keep `day`, clamped to short months. */
export function advanceDue(date: string, frequency: BillFrequency, day: number): string {
  const d = parseISO(date)
  if (frequency === 'weekly') return format(addDays(d, 7), 'yyyy-MM-dd')
  const first = addMonths(startOfMonth(d), frequency === 'yearly' ? 12 : 1)
  return format(setDate(first, Math.min(day, getDaysInMonth(first))), 'yyyy-MM-dd')
}

/** Next due date once a bill is paid on `today`: one period on, and always after today. */
export function nextDueAfterPaying(bill: Bill, today: string): string {
  let next = advanceDue(bill.nextDue, bill.frequency, bill.day)
  for (let i = 0; i < 1000 && next <= today; i++) next = advanceDue(next, bill.frequency, bill.day)
  return next
}

/** Negative = overdue. */
export const daysUntilDue = (bill: Bill, today: string) => differenceInCalendarDays(parseISO(bill.nextDue), parseISO(today))

/** Bills overdue or due within `withinDays`, soonest first. */
export function billsDue(bills: Bill[], today: string, withinDays: number): Bill[] {
  return bills.filter((b) => daysUntilDue(b, today) <= withinDays).sort((a, b) => a.nextDue.localeCompare(b.nextDue))
}

/** What the bills cost in an average month. */
export function monthlyBillTotal(bills: Bill[]): number {
  return bills.reduce((sum, b) => sum + (b.frequency === 'weekly' ? (b.amount * 52) / 12 : b.frequency === 'yearly' ? b.amount / 12 : b.amount), 0)
}

export function goalProgress(goal: Goal, today: string) {
  const remaining = Math.max(goal.target - goal.saved, 0)
  const ratio = goal.target > 0 ? Math.min(goal.saved / goal.target, 1) : 0
  const reached = goal.target > 0 && goal.saved >= goal.target
  const days = goal.deadline ? differenceInCalendarDays(parseISO(goal.deadline), parseISO(today)) : null
  const late = !reached && days !== null && days < 0
  const perMonth = !reached && days !== null && days >= 0 ? Math.ceil(remaining / Math.max(1, Math.ceil(days / 30))) : null
  return { remaining, ratio, reached, days, late, perMonth }
}
