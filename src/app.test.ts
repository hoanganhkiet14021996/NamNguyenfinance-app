/**
 * Smoke tests for everyday tasks. Run after any change:  npm run check
 * (runs these tests, then the type-check and production build).
 * Supabase is faked here: nothing is sent to the real database.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const cloudCalls = vi.hoisted(() => [] as { table: string; op: 'upsert' | 'delete'; ids: string[] }[])

vi.mock('./lib/supabase', () => ({
  cloudConfigured: true,
  supabase: {
    from: (table: string) => ({
      upsert: async (rows: Record<string, unknown> | Record<string, unknown>[]) => {
        const list = Array.isArray(rows) ? rows : [rows]
        cloudCalls.push({ table, op: 'upsert', ids: list.map((r) => String(r.id ?? r.user_id)) })
        return { error: null }
      },
      delete: () => ({
        eq: () => ({
          in: async (_col: string, ids: string[]) => {
            cloudCalls.push({ table, op: 'delete', ids })
            return { error: null }
          },
        }),
      }),
    }),
  },
}))

import { upgradeCategories } from './data/categories'
import { buildEmptyData } from './data/demo'
import { normalizeUsername, usernameToEmail, validatePin, validateUsername } from './lib/auth'
import { advanceDue, billsDue, budgetUsage, budgetsForMonth, computeBalances, goalProgress, monthSummary, monthlyBillTotal, monthlyLimit, nextDueAfterPaying } from './lib/calc'
import { pushChanges } from './lib/cloud'
import { normalizeText } from './lib/format'
import { loadData, saveData } from './lib/storage'
import type { Account, AppData, Bill, Goal, Transaction } from './types'

const MONTH = '2026-10'

function startData(): AppData {
  const wallet: Account = { id: 'wallet', name: 'Wallet', institution: '', type: 'cash', openingBalance: 1_000_000, archived: false, updatedAt: '2026-10-01' }
  const bank: Account = { id: 'bank', name: 'Bank', institution: '', type: 'bank', openingBalance: 5_000_000, archived: false, updatedAt: '2026-10-01' }
  return { ...buildEmptyData(), accounts: [wallet, bank] }
}

const expense = (id: string, amount: number, categoryId = 'food'): Transaction => ({
  id,
  type: 'expense',
  date: `${MONTH}-05`,
  amount,
  description: 'Cơm tấm',
  categoryId,
  accountId: 'wallet',
})

// Same edits the app store makes (src/store/AppStore.tsx)
const add = (d: AppData, tx: Transaction): AppData => ({ ...d, transactions: [...d.transactions, tx] })
const edit = (d: AppData, tx: Transaction): AppData => ({ ...d, transactions: d.transactions.map((t) => (t.id === tx.id ? tx : t)) })
const remove = (d: AppData, id: string): AppData => ({ ...d, transactions: d.transactions.filter((t) => t.id !== id) })
const walletBalance = (d: AppData) => computeBalances(d.accounts, d.transactions).get('wallet')

describe('sign-in (name + PIN)', () => {
  it('turns a Vietnamese name into a plain login name', () => {
    expect(normalizeUsername('Kiệt Hoàng')).toBe('kiethoang')
    expect(normalizeUsername('Đức')).toBe('duc')
    expect(usernameToEmail('Nam Nguyễn')).toMatch(/^namnguyen@/)
  })

  it('accepts only a 6-digit PIN and a name of 3+ characters', () => {
    expect(validatePin('123456')).toBeNull()
    expect(validatePin('12345')).not.toBeNull()
    expect(validatePin('12a456')).not.toBeNull()
    expect(validateUsername('ab')).not.toBeNull()
    expect(validateUsername('nam')).toBeNull()
  })
})

describe('search', () => {
  it('finds Vietnamese text typed without accents', () => {
    expect(normalizeText('Cơm tấm').includes(normalizeText('com tam'))).toBe(true)
    expect(normalizeText('Đồ ăn').includes(normalizeText('DO AN'))).toBe(true)
    expect(normalizeText('Cơm tấm').includes(normalizeText('bun bo'))).toBe(false)
  })
})

describe('transactions', () => {
  it('add: spending lowers the wallet and counts as this month’s expense', () => {
    const d = add(startData(), expense('t1', 50_000))
    expect(walletBalance(d)).toBe(950_000)
    expect(monthSummary(d.transactions, MONTH).expenses).toBe(50_000)
  })

  it('edit: changing the amount updates balance and totals', () => {
    let d = add(startData(), expense('t1', 50_000))
    d = edit(d, expense('t1', 80_000))
    expect(walletBalance(d)).toBe(920_000)
    expect(monthSummary(d.transactions, MONTH).expenses).toBe(80_000)
  })

  it('delete: removing a transaction gives the money back', () => {
    let d = add(startData(), expense('t1', 50_000))
    d = add(d, expense('t2', 30_000))
    d = remove(d, 't1')
    expect(d.transactions.map((t) => t.id)).toEqual(['t2'])
    expect(walletBalance(d)).toBe(970_000)
    expect(monthSummary(d.transactions, MONTH).expenses).toBe(30_000)
  })

  it('income adds money; a transfer moves money but is not income or expense', () => {
    let d = add(startData(), { ...expense('salary', 20_000_000), type: 'income', accountId: 'bank', categoryId: 'salary' })
    d = add(d, { ...expense('atm', 2_000_000), type: 'transfer', accountId: 'bank', toAccountId: 'wallet', categoryId: null })
    const b = computeBalances(d.accounts, d.transactions)
    expect(b.get('bank')).toBe(23_000_000)
    expect(b.get('wallet')).toBe(3_000_000)
    const s = monthSummary(d.transactions, MONTH)
    expect(s.income).toBe(20_000_000)
    expect(s.expenses).toBe(0)
  })
})

describe('budgets', () => {
  it('a monthly budget tracks what was spent in that category', () => {
    let d = startData()
    d = { ...d, budgets: [{ id: 'b1', month: 'all', categoryId: 'food', amount: 3_000_000 }] }
    d = add(d, expense('t1', 1_000_000))
    d = add(d, expense('t2', 500_000, 'other'))
    const [food] = budgetsForMonth(d.budgets, MONTH)
    expect(budgetUsage(food, d.transactions, MONTH)).toMatchObject({ spent: 1_000_000, remaining: 2_000_000 })
    expect(monthlyLimit({ ...d.plan, monthlyBudget: 0 }, d.budgets, MONTH)).toBe(3_000_000)
  })
})

describe('categories', () => {
  it('an old account gets the new list: Shopping goes, its spending moves to Other, nothing is lost', () => {
    const old = { ...startData().categories[0], id: 'shopping', name: 'Shopping' }
    let d: AppData = { ...startData(), categories: [old], budgets: [{ id: 'b1', month: 'all', categoryId: 'shopping', amount: 1 }] }
    d = add(d, expense('t1', 200_000, 'shopping'))
    const up = upgradeCategories(d)
    const ids = up.categories.map((c) => c.id)
    expect(ids).toEqual(expect.arrayContaining(['food', 'drinks', 'groceries', 'clothes', 'sports', 'hangouts']))
    expect(ids).not.toContain('shopping')
    expect(up.transactions[0]).toMatchObject({ categoryId: 'other', amount: 200_000 })
    expect(up.budgets).toEqual([])
    expect(upgradeCategories(up)).toBe(up)
  })
})

const rent: Bill = { id: 'b1', name: 'Rent', amount: 9_000_000, categoryId: 'housing', accountId: 'bank', frequency: 'monthly', nextDue: '2026-10-31', day: 31 }

describe('bills', () => {
  it('shows only bills that are overdue or due within the week, soonest first', () => {
    const power: Bill = { ...rent, id: 'b2', name: 'Power', nextDue: '2026-10-09', day: 9 }
    const gym: Bill = { ...rent, id: 'b3', name: 'Gym', nextDue: '2026-10-05', day: 5 }
    expect(billsDue([rent, power, gym], '2026-10-07', 7).map((b) => b.id)).toEqual(['b3', 'b2'])
  })

  it('paying a monthly bill moves it to the next month and keeps the day of month', () => {
    expect(advanceDue('2026-01-31', 'monthly', 31)).toBe('2026-02-28')
    expect(advanceDue('2026-02-28', 'monthly', 31)).toBe('2026-03-31')
    expect(advanceDue('2026-10-07', 'weekly', 7)).toBe('2026-10-14')
    expect(advanceDue('2026-10-07', 'yearly', 7)).toBe('2027-10-07')
  })

  it('a very late payment still lands on a future date', () => {
    const late: Bill = { ...rent, nextDue: '2026-07-31' }
    expect(nextDueAfterPaying(late, '2026-10-07')).toBe('2026-10-31')
    expect(nextDueAfterPaying(rent, '2026-10-31')).toBe('2026-11-30')
  })

  it('adds up an average month of bills', () => {
    const weekly: Bill = { ...rent, id: 'w', amount: 120_000, frequency: 'weekly' }
    const yearly: Bill = { ...rent, id: 'y', amount: 1_200_000, frequency: 'yearly' }
    expect(Math.round(monthlyBillTotal([rent, weekly, yearly]))).toBe(9_000_000 + 520_000 + 100_000)
  })

  it('paying a bill records one expense and lowers the account', () => {
    const d: AppData = { ...startData(), bills: [rent] }
    const paid = add(d, { id: 't1', type: 'expense', date: '2026-10-31', amount: rent.amount, description: rent.name, categoryId: rent.categoryId, accountId: rent.accountId })
    expect(computeBalances(paid.accounts, paid.transactions).get('bank')).toBe(5_000_000 - 9_000_000)
    expect(monthSummary(paid.transactions, '2026-10').expenses).toBe(9_000_000)
  })
})

describe('goals', () => {
  const trip: Goal = { id: 'g1', name: 'Trip', target: 12_000_000, saved: 3_000_000, deadline: '2027-01-07', createdAt: '2026-10-01' }

  it('shows progress and how much to save each month', () => {
    const p = goalProgress(trip, '2026-10-07')
    expect(p.ratio).toBe(0.25)
    expect(p.remaining).toBe(9_000_000)
    expect(p.perMonth).toBe(2_250_000) // 92 days rounds up to 4 months: 9M / 4
    expect(p.reached).toBe(false)
  })

  it('knows when a goal is reached or past its deadline', () => {
    expect(goalProgress({ ...trip, saved: 12_000_000 }, '2026-10-07').reached).toBe(true)
    expect(goalProgress(trip, '2027-02-01').late).toBe(true)
    expect(goalProgress({ ...trip, deadline: undefined }, '2026-10-07').perMonth).toBeNull()
  })
})

describe('saving', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    ;(globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    } as Storage
    cloudCalls.length = 0
  })

  it('the copy on this device survives a reload', () => {
    const d = add(startData(), expense('t1', 50_000))
    saveData(d)
    expect(loadData()?.transactions.map((t) => t.id)).toEqual(['t1'])
  })

  it('cloud sync sends new/edited transactions and deletes removed ones', async () => {
    const before = add(add(startData(), expense('t1', 50_000)), expense('t2', 30_000))
    let after = remove(before, 't1')
    after = edit(after, expense('t2', 35_000))
    after = add(after, expense('t3', 10_000))

    await pushChanges('user-1', before, after)

    const tx = cloudCalls.filter((c) => c.table === 'fin_transactions')
    expect(tx).toEqual([
      { table: 'fin_transactions', op: 'upsert', ids: ['t2', 't3'] },
      { table: 'fin_transactions', op: 'delete', ids: ['t1'] },
    ])
    // Nothing else changed, so nothing else is sent
    expect(cloudCalls.filter((c) => c.table !== 'fin_transactions')).toEqual([])
  })

  it('cloud sync sends bills and goals too', async () => {
    const before = startData()
    const after: AppData = {
      ...before,
      bills: [rent],
      goals: [{ id: 'g1', name: 'Trip', target: 1_000_000, saved: 0, createdAt: '2026-10-01' }],
    }
    await pushChanges('user-1', before, after)
    expect(cloudCalls).toEqual([
      { table: 'fin_bills', op: 'upsert', ids: ['b1'] },
      { table: 'fin_goals', op: 'upsert', ids: ['g1'] },
    ])
  })

  it('a copy saved before bills and goals existed still opens', () => {
    const old = { ...startData(), version: 2 } as Record<string, unknown>
    delete old.bills
    delete old.goals
    localStorage.setItem('personal-cfo.v1', JSON.stringify(old))
    const loaded = loadData()
    expect(loaded?.bills).toEqual([])
    expect(loaded?.goals).toEqual([])
  })

  it('first sign-in uploads everything, settings last', async () => {
    await pushChanges('user-1', null, add(startData(), expense('t1', 50_000)))
    expect(cloudCalls.at(-1)?.table).toBe('fin_settings')
    expect(cloudCalls.find((c) => c.table === 'fin_transactions')?.ids).toEqual(['t1'])
  })
})
