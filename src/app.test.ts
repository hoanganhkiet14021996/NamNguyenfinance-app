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

import { buildEmptyData } from './data/demo'
import { normalizeUsername, usernameToEmail, validatePin, validateUsername } from './lib/auth'
import { budgetUsage, budgetsForMonth, computeBalances, monthSummary, monthlyLimit } from './lib/calc'
import { pushChanges } from './lib/cloud'
import { loadData, saveData } from './lib/storage'
import type { Account, AppData, Transaction } from './types'

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

  it('first sign-in uploads everything, settings last', async () => {
    await pushChanges('user-1', null, add(startData(), expense('t1', 50_000)))
    expect(cloudCalls.at(-1)?.table).toBe('fin_settings')
    expect(cloudCalls.find((c) => c.table === 'fin_transactions')?.ids).toEqual(['t1'])
  })
})
