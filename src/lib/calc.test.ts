import { describe, expect, it } from 'vitest'
import { buildDemoData } from '../data/demo'
import { balancesAtDates, computeBalances, monthSummary, totalsFromBalances } from './calc'
import type { Account, Transaction } from '../types'

const acc = (id: string, type: Account['type'], openingBalance: number): Account => ({
  id,
  name: id,
  institution: id,
  type,
  openingBalance,
  archived: false,
  updatedAt: '2026-01-01',
})
const tx = (t: Partial<Transaction> & Pick<Transaction, 'id' | 'type' | 'amount' | 'accountId'>): Transaction => ({
  date: '2026-09-10',
  description: '',
  categoryId: null,
  ...t,
})

describe('balances', () => {
  const accounts = [acc('a', 'bank', 100), acc('b', 'bank', 50), acc('cc', 'credit_card', 0)]

  it('applies income, expense and transfer', () => {
    const b = computeBalances(accounts, [
      tx({ id: '1', type: 'income', amount: 30, accountId: 'a' }),
      tx({ id: '2', type: 'expense', amount: 10, accountId: 'a' }),
      tx({ id: '3', type: 'transfer', amount: 40, accountId: 'a', toAccountId: 'b' }),
    ])
    expect(b.get('a')).toBe(80)
    expect(b.get('b')).toBe(90)
  })

  it('removing a transaction reverses its impact', () => {
    const t = tx({ id: '1', type: 'expense', amount: 25, accountId: 'a' })
    expect(computeBalances(accounts, [t]).get('a')).toBe(75)
    expect(computeBalances(accounts, []).get('a')).toBe(100)
  })

  it('transfers do not count as income or expenses', () => {
    const s = monthSummary([tx({ id: '1', type: 'transfer', amount: 999, accountId: 'a', toAccountId: 'b' })], '2026-09')
    expect(s.income).toBe(0)
    expect(s.expenses).toBe(0)
  })

  it('credit card spend increases liabilities and lowers net worth', () => {
    const b = computeBalances(accounts, [tx({ id: '1', type: 'expense', amount: 20, accountId: 'cc' })])
    const t = totalsFromBalances(accounts, b)
    expect(t.liabilities).toBe(20)
    expect(t.netWorth).toBe(130)
  })

  it('balancesAtDates matches computeBalances', () => {
    const txs = [
      tx({ id: '1', type: 'income', amount: 30, accountId: 'a', date: '2026-08-01' }),
      tx({ id: '2', type: 'expense', amount: 10, accountId: 'a', date: '2026-09-01' }),
    ]
    const [aug, sep] = balancesAtDates(accounts, txs, ['2026-08-31', '2026-09-30'])
    expect(aug.get('a')).toBe(130)
    expect(sep.get('a')).toBe(computeBalances(accounts, txs).get('a'))
  })
})

describe('demo data', () => {
  const today = '2026-09-20'
  const data = buildDemoData(today)
  const balances = computeBalances(data.accounts, data.transactions)

  it('hits target balances', () => {
    expect(balances.get('acc-tcb')).toBe(85_200_000)
    expect(balances.get('acc-mirae')).toBe(620_000_000)
  })

  it('cash accounts never go negative', () => {
    const dates = Array.from(new Set(data.transactions.map((t) => t.date))).sort()
    const cash = data.accounts.filter((a) => a.type === 'bank')
    for (const b of balancesAtDates(cash, data.transactions, dates)) {
      for (const a of cash) expect(b.get(a.id)!).toBeGreaterThanOrEqual(0)
    }
  })

  it('has a healthy current month', () => {
    const s = monthSummary(data.transactions, '2026-09')
    expect(s.income).toBeGreaterThan(60_000_000)
    expect(s.savingsRate!).toBeGreaterThan(0.3)
  })
})
