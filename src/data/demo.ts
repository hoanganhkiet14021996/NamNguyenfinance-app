import { computeBalances, monthRange, shiftMonth } from '../lib/calc'
import { defaultCategories } from './categories'
import { defaultPrefs, defaultSettings, demoPlan, emptyPlan } from './settings'
import type { Account, AppData, Bill, Budget, Goal, Transaction } from '../types'

export const DATA_VERSION = 3
const HISTORY_MONTHS = 9

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const POOLS: Record<string, string[]> = {
  food: ["Dinner at Pizza 4P's", 'GrabFood order', 'Cơm tấm', 'Phở lunch', 'Weekend brunch'],
  drinks: ['Highlands Coffee', 'The Coffee House', 'Phúc Long milk tea', 'Cà phê sữa đá'],
  groceries: ['Bách Hóa Xanh', 'WinMart', 'Co.op Mart'],
  transport: ['Grab ride', 'Xanh SM ride', 'Gasoline - Petrolimex', 'Parking', 'Grab bike'],
  clothes: ['Uniqlo', 'Zara', 'Shopee order'],
  entertainment: ['CGV Cinemas', 'Karaoke night', 'Steam games', 'Concert tickets'],
  health: ['Pharmacity', 'Dental checkup', 'Health check-up'],
  travel: ['Vietjet flight to Da Nang', 'Hotel booking Da Lat', 'Traveloka trip'],
  education: ['Udemy course', 'English class fee', 'Book purchase'],
  other: ['Haircut', 'Gift for friend', 'Bank fee', 'Laundry'],
}

export function buildDemoData(today: string): AppData {
  const rand = rng(2026)
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)]
  const between = (min: number, max: number) => min + rand() * (max - min)
  const round = (n: number, step: number) => Math.max(step, Math.round(n / step) * step)

  const currentMonth = today.slice(0, 7)
  const todayDay = Number(today.slice(8))
  const months = monthRange(currentMonth, HISTORY_MONTHS)

  const accounts: Account[] = [
    { id: 'acc-tcb', name: 'Techcombank', institution: 'Techcombank', type: 'bank', openingBalance: 0, archived: false, updatedAt: today },
    { id: 'acc-vcb', name: 'Vietcombank', institution: 'Vietcombank', type: 'bank', openingBalance: 0, archived: false, updatedAt: today },
    { id: 'acc-mirae', name: 'Mirae Asset', institution: 'Mirae Asset', type: 'investment', openingBalance: 0, archived: false, updatedAt: today },
    { id: 'acc-cc', name: 'Credit Card', institution: 'Techcombank Visa', type: 'credit_card', openingBalance: 0, archived: false, updatedAt: today },
    { id: 'acc-car', name: 'Car Loan', institution: 'VPBank', type: 'loan', openingBalance: 0, archived: false, updatedAt: today },
    { id: 'acc-personal', name: 'Personal Loan', institution: 'FE Credit', type: 'loan', openingBalance: 0, archived: false, updatedAt: today },
  ]

  const txs: Transaction[] = []
  let n = 0
  const add = (t: Omit<Transaction, 'id'>) => {
    if (t.date > today) return
    txs.push({ id: `tx_demo_${++n}`, ...t })
  }
  const date = (month: string, day: number) => `${month}-${String(day).padStart(2, '0')}`

  function scaled(month: string, category: string, total: number, count: number, accountFor: () => string, maxDay: number) {
    if (total <= 0 || count <= 0) return
    const weights = Array.from({ length: count }, () => between(0.4, 1.6))
    const sum = weights.reduce((s, w) => s + w, 0)
    let left = total
    const days = Array.from({ length: count }, () => 1 + Math.floor(rand() * maxDay)).sort((a, b) => a - b)
    weights.forEach((w, i) => {
      const amount = i === count - 1 ? left : round((total * w) / sum, 5000)
      left -= amount
      if (amount <= 0) return
      const description = pick(POOLS[category])
      add({
        type: 'expense',
        date: date(month, days[i]),
        amount,
        description,
        merchant: description.split(' - ')[0],
        categoryId: category,
        accountId: accountFor(),
      })
    })
  }

  for (const month of months) {
    const isCurrent = month === currentMonth
    const maxDay = isCurrent ? todayDay : 28
    const isJan = month.endsWith('-01')

    add({ type: 'income', date: date(month, 5), amount: 60_000_000, description: 'Salary', categoryId: 'salary', accountId: 'acc-tcb', merchant: 'Employer' })
    if (isCurrent) {
      add({ type: 'income', date: date(month, 12), amount: 8_500_000, description: 'Freelance design project', categoryId: 'other-income', accountId: 'acc-tcb' })
    } else if (rand() < 0.6) {
      add({ type: 'income', date: date(month, 10 + Math.floor(rand() * 15)), amount: round(between(3_000_000, 9_000_000), 100_000), description: 'Freelance project', categoryId: 'other-income', accountId: 'acc-tcb' })
    }
    add({ type: 'income', date: date(month, 15), amount: round(between(1_000_000, 2_000_000), 50_000), description: 'Dividend payout', categoryId: 'invest-income', accountId: 'acc-mirae' })
    if (isJan) add({ type: 'income', date: date(month, 20), amount: 40_000_000, description: 'Tet bonus', categoryId: 'bonus', accountId: 'acc-tcb' })

    add({ type: 'expense', date: date(month, 1), amount: 9_000_000, description: 'Apartment rent', categoryId: 'housing', accountId: 'acc-tcb' })
    add({ type: 'expense', date: date(month, 8), amount: round(between(1_100_000, 1_600_000), 10_000), description: 'Electricity, water & internet', categoryId: 'housing', accountId: 'acc-tcb' })
    add({ type: 'expense', date: date(month, 7), amount: 3_000_000, description: 'Support for parents', categoryId: 'family', accountId: 'acc-tcb' })
    add({ type: 'expense', date: date(month, 2), amount: 600_000, description: 'Gym membership', categoryId: 'sports', accountId: 'acc-tcb' })
    add({ type: 'expense', date: date(month, 3), amount: 260_000, description: 'Netflix', categoryId: 'subscriptions', accountId: 'acc-cc', merchant: 'Netflix' })
    add({ type: 'expense', date: date(month, 3), amount: 59_000, description: 'Spotify Premium', categoryId: 'subscriptions', accountId: 'acc-cc', merchant: 'Spotify' })

    const cc = (p: number) => () => (rand() < p ? 'acc-cc' : 'acc-tcb')
    const tcb = () => 'acc-tcb'
    scaled(month, 'food', isCurrent ? 5_600_000 : round(between(6_000_000, 7_500_000), 5000), 4, cc(0.3), maxDay)
    scaled(month, 'drinks', isCurrent ? 1_200_000 : round(between(1_000_000, 1_800_000), 5000), 4, cc(0.3), maxDay)
    scaled(month, 'groceries', isCurrent ? 1_400_000 : round(between(1_500_000, 2_200_000), 5000), 2, tcb, maxDay)
    scaled(month, 'transport', isCurrent ? 2_100_000 : round(between(2_400_000, 3_500_000), 5000), 3, tcb, maxDay)
    scaled(month, 'clothes', isCurrent ? 7_100_000 : round(between(3_500_000, 7_000_000), 5000), 2, cc(0.7), maxDay)
    scaled(month, 'entertainment', isCurrent ? 1_400_000 : round(between(1_200_000, 2_600_000), 5000), 2, cc(0.5), maxDay)
    scaled(month, 'health', isCurrent ? 800_000 : rand() < 0.6 ? round(between(300_000, 1_500_000), 5000) : 0, 1, tcb, maxDay)
    scaled(month, 'other', isCurrent ? 600_000 : round(between(300_000, 1_200_000), 5000), 1, tcb, maxDay)
    if (!isCurrent) {
      if (month.endsWith('-12') || rand() < 0.15) scaled(month, 'travel', round(between(4_000_000, 9_000_000), 50_000), 1, cc(0.6), maxDay)
      if (rand() < 0.25) scaled(month, 'education', 1_500_000, 1, tcb, maxDay)
    }

    add({ type: 'transfer', date: date(month, 6), amount: 22_000_000, description: 'Monthly investment contribution', categoryId: null, accountId: 'acc-tcb', toAccountId: 'acc-mirae' })
    add({ type: 'transfer', date: date(month, 6), amount: 2_000_000, description: 'Savings top-up', categoryId: null, accountId: 'acc-tcb', toAccountId: 'acc-vcb' })
    add({ type: 'transfer', date: date(month, 10), amount: 6_500_000, description: 'Car loan repayment', categoryId: null, accountId: 'acc-tcb', toAccountId: 'acc-car' })
    add({ type: 'transfer', date: date(month, 10), amount: 3_500_000, description: 'Personal loan repayment', categoryId: null, accountId: 'acc-tcb', toAccountId: 'acc-personal' })
    if (!isCurrent) {
      const owed = txs
        .filter((t) => t.accountId === 'acc-cc' && t.type === 'expense' && t.date.startsWith(month))
        .reduce((s, t) => s + t.amount, 0)
      add({ type: 'transfer', date: date(month, 25), amount: owed, description: 'Credit card payment', categoryId: null, accountId: 'acc-tcb', toAccountId: 'acc-cc' })
    }
  }

  txs.sort((a, b) => a.date.localeCompare(b.date))

  const targets: Record<string, number> = {
    'acc-tcb': 85_200_000,
    'acc-vcb': 42_800_000,
    'acc-mirae': 620_000_000,
    'acc-car': -210_000_000,
    'acc-personal': -40_000_000,
  }
  const flows = computeBalances(accounts, txs)
  for (const a of accounts) {
    if (a.id in targets) a.openingBalance = targets[a.id] - (flows.get(a.id) ?? 0)
  }

  const budgets: Budget[] = [
    { id: 'bud_food', month: 'all', categoryId: 'food', amount: 10_000_000 },
    { id: 'bud_transport', month: 'all', categoryId: 'transport', amount: 5_000_000 },
    { id: 'bud_clothes', month: 'all', categoryId: 'clothes', amount: 6_000_000 },
  ]

  // Next payment on `day` of the month: this month if it is still ahead, else next month.
  const dueOn = (day: number) => {
    const thisMonth = date(currentMonth, day)
    return thisMonth >= today ? thisMonth : date(shiftMonth(currentMonth, 1), day)
  }
  const bills: Bill[] = [
    { id: 'bill_rent', name: 'Apartment rent', amount: 9_000_000, categoryId: 'housing', accountId: 'acc-tcb', frequency: 'monthly', nextDue: dueOn(1), day: 1 },
    { id: 'bill_power', name: 'Electricity & water', amount: 1_300_000, categoryId: 'housing', accountId: 'acc-tcb', frequency: 'monthly', nextDue: dueOn(8), day: 8 },
    { id: 'bill_gym', name: 'Gym membership', amount: 600_000, categoryId: 'sports', accountId: 'acc-tcb', frequency: 'monthly', nextDue: dueOn(2), day: 2 },
  ]
  const goals: Goal[] = [
    { id: 'goal_trip', name: 'Trip to Japan', target: 60_000_000, saved: 24_000_000, deadline: date(shiftMonth(currentMonth, 8), 15), createdAt: today },
  ]

  return {
    version: DATA_VERSION,
    isDemo: true,
    settings: { ...defaultSettings },
    prefs: { ...defaultPrefs, lastAccountId: {}, lastCategoryId: {} },
    plan: { ...demoPlan },
    accounts,
    categories: defaultCategories,
    transactions: txs,
    budgets,
    bills,
    goals,
    dismissedInsights: [],
  }
}

export function buildEmptyData(previous?: AppData): AppData {
  return {
    version: DATA_VERSION,
    isDemo: false,
    settings: previous?.settings ?? { ...defaultSettings },
    prefs: { ...defaultPrefs, lastAccountId: {}, lastCategoryId: {} },
    plan: { ...emptyPlan },
    accounts: [],
    categories: defaultCategories,
    transactions: [],
    budgets: [],
    bills: [],
    goals: [],
    dismissedInsights: [],
  }
}

