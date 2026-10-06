import type { AppData, Category } from '../types'

export const defaultCategories: Category[] = [
  { id: 'food', name: 'Food', kind: 'expense', icon: 'Utensils', color: '#b45309' },
  { id: 'drinks', name: 'Coffee & Drinks', kind: 'expense', icon: 'Coffee', color: '#7c4a2d' },
  { id: 'transport', name: 'Transport', kind: 'expense', icon: 'Car', color: '#3b6ea5' },
  { id: 'groceries', name: 'Groceries', kind: 'expense', icon: 'ShoppingBasket', color: '#4d7c0f' },
  { id: 'other', name: 'Other', kind: 'expense', icon: 'Ellipsis', color: '#78716c' },
  { id: 'clothes', name: 'Clothes', kind: 'expense', icon: 'Shirt', color: '#b03a7a' },
  { id: 'sports', name: 'Sports & Fitness', kind: 'expense', icon: 'Dumbbell', color: '#c2410c' },
  { id: 'housing', name: 'Housing & Bills', kind: 'expense', icon: 'Home', color: '#166534' },
  { id: 'hangouts', name: 'Hangouts & Gifts', kind: 'expense', icon: 'PartyPopper', color: '#a16207' },
  { id: 'entertainment', name: 'Entertainment', kind: 'expense', icon: 'Clapperboard', color: '#6d5aa6' },
  { id: 'subscriptions', name: 'Subscriptions', kind: 'expense', icon: 'Repeat', color: '#7a7a45' },
  { id: 'travel', name: 'Travel', kind: 'expense', icon: 'Plane', color: '#2a8790' },
  { id: 'health', name: 'Health & Care', kind: 'expense', icon: 'HeartPulse', color: '#b34a3c' },
  { id: 'family', name: 'Family', kind: 'expense', icon: 'Users', color: '#9d4b6b' },
  { id: 'education', name: 'Education', kind: 'expense', icon: 'GraduationCap', color: '#4b6a9d' },
  { id: 'salary', name: 'Salary', kind: 'income', icon: 'Wallet', color: '#0e7a54' },
  { id: 'bonus', name: 'Bonus', kind: 'income', icon: 'Gift', color: '#3f8f5c' },
  { id: 'invest-income', name: 'Investment Income', kind: 'income', icon: 'TrendingUp', color: '#8a6d1f' },
  { id: 'other-income', name: 'Other Income', kind: 'income', icon: 'CirclePlus', color: '#78716c' },
]

/** Always shown first on Home's quick add, in this order (the rest sit behind "More"). */
export const pinnedExpenseIds = ['food', 'drinks', 'transport', 'groceries', 'other']

/** Categories that were dropped, and where their transactions go. */
const removedCategories: Record<string, string> = { shopping: 'other' }

/**
 * Brings saved data (local or cloud) up to the current category list: default categories take their
 * current name/icon/color, missing ones are added, removed ones are dropped and their transactions moved.
 * Returns the same object when nothing changes, so a fresh account does not trigger a sync.
 */
export function upgradeCategories(data: AppData): AppData {
  const defaultIds = new Set(defaultCategories.map((c) => c.id))
  const custom = data.categories.filter((c) => !defaultIds.has(c.id) && !(c.id in removedCategories))
  const categories = [...defaultCategories, ...custom]
  const transactions = data.transactions.map((t) =>
    t.categoryId && t.categoryId in removedCategories ? { ...t, categoryId: removedCategories[t.categoryId] } : t,
  )
  const budgets = data.budgets.filter((b) => !(b.categoryId in removedCategories))

  const same =
    JSON.stringify(categories) === JSON.stringify(data.categories) &&
    transactions.every((t, i) => t === data.transactions[i]) &&
    budgets.length === data.budgets.length
  return same ? data : { ...data, categories, transactions, budgets }
}
