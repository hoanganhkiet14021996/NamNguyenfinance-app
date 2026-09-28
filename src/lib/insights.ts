import { CASH_TYPES, monthEnd, monthRange, monthSummary, shiftMonth, balancesAtDates, totalsFromBalances, budgetUsage, budgetsForMonth } from './calc'
import { formatMoney, monthTitle } from './format'
import type { Account, Budget, Category, Insight, Transaction } from '../types'

interface Input {
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  budgets: Budget[]
  today: string
}

const money = (n: number) => formatMoney(n, { mode: 'compact' })

function categorySpend(txs: Transaction[], categoryId: string, month: string, untilDay: number) {
  let total = 0
  for (const t of txs) {
    if (t.type === 'expense' && t.categoryId === categoryId && t.date.startsWith(month) && Number(t.date.slice(8)) <= untilDay) {
      total += t.amount
    }
  }
  return total
}

export function buildInsights({ accounts, categories, transactions, budgets, today }: Input): Insight[] {
  const month = today.slice(0, 7)
  const day = Number(today.slice(8))
  const insights: Insight[] = []
  const catName = new Map(categories.map((c) => [c.id, c.name]))

  for (const budget of budgetsForMonth(budgets, month)) {
    const { spent, ratio } = budgetUsage(budget, transactions, month)
    if (ratio > 1) {
      insights.push({
        id: `budget:${month}:${budget.categoryId}`,
        tone: 'warning',
        text: `${catName.get(budget.categoryId)} exceeded the monthly budget by ${money(spent - budget.amount)}.`,
        source: `${money(spent)} spent of ${money(budget.amount)} budget in ${monthTitle(month)}`,
        link: `/transactions?category=${budget.categoryId}&range=month`,
      })
    }
  }

  const previous = monthRange(shiftMonth(month, -1), 3)
  for (const cat of categories.filter((c) => c.kind === 'expense')) {
    const now = categorySpend(transactions, cat.id, month, day)
    const avg = previous.reduce((s, m) => s + categorySpend(transactions, cat.id, m, day), 0) / previous.length
    if (avg > 500_000 && now > 0) {
      const diff = now / avg - 1
      if (Math.abs(diff) >= 0.15) {
        insights.push({
          id: `trend:${month}:${cat.id}`,
          tone: diff > 0 ? 'warning' : 'positive',
          text: `${cat.name} spending is ${Math.round(Math.abs(diff) * 100)}% ${diff > 0 ? 'higher' : 'lower'} than your 3-month average.`,
          source: `${money(now)} in the first ${day} days of ${monthTitle(month)} vs ${money(avg)} average for the same days`,
          link: `/transactions?category=${cat.id}&range=month`,
        })
      }
    }
  }

  const thisMonth = monthSummary(transactions, month)
  const lastMonth = monthSummary(transactions, shiftMonth(month, -1))
  if (thisMonth.savingsRate !== null && lastMonth.savingsRate !== null) {
    const delta = thisMonth.savingsRate - lastMonth.savingsRate
    if (Math.abs(delta) >= 0.03) {
      insights.push({
        id: `savings:${month}`,
        tone: delta > 0 ? 'positive' : 'warning',
        text: `Your savings rate ${delta > 0 ? 'increased' : 'decreased'} from ${Math.round(lastMonth.savingsRate * 100)}% to ${Math.round(thisMonth.savingsRate * 100)}% this month.`,
        source: `Income ${money(thisMonth.income)}, expenses ${money(thisMonth.expenses)} in ${monthTitle(month)}`,
      })
    }
  }

  const cashAccounts = accounts.filter((a) => CASH_TYPES.includes(a.type))
  const dates = [monthEnd(shiftMonth(month, -4)), monthEnd(shiftMonth(month, -3)), monthEnd(shiftMonth(month, -2)), monthEnd(shiftMonth(month, -1)), today]
  const cash = balancesAtDates(cashAccounts, transactions, dates).map((b) => totalsFromBalances(cashAccounts, b).cash)
  let streak = 0
  for (let i = cash.length - 1; i > 0 && cash[i] > cash[i - 1]; i--) streak++
  if (streak >= 2) {
    insights.push({
      id: `cash-streak:${month}`,
      tone: 'positive',
      text: `Your cash balance increased for ${streak} consecutive months.`,
      source: `Cash grew from ${money(cash[cash.length - 1 - streak])} to ${money(cash[cash.length - 1])}`,
    })
  }

  const subs = categories.find((c) => c.name === 'Subscriptions')
  if (subs) {
    const total = previous.reduce((s, m) => s + categorySpend(transactions, subs.id, m, 31), 0) / previous.length
    if (total > 0) {
      insights.push({
        id: `subs:${month}`,
        tone: 'info',
        text: `Subscriptions account for ${money(total)}/month.`,
        source: `Average of ${previous.length} full months`,
        link: `/transactions?category=${subs.id}&range=3m`,
      })
    }
  }

  const rank = { warning: 0, positive: 1, info: 2 }
  return insights.sort((a, b) => rank[a.tone] - rank[b.tone])
}
