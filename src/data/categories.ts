import type { Category } from '../types'

export const defaultCategories: Category[] = [
  { id: 'housing', name: 'Housing', kind: 'expense', icon: 'Home', color: '#166534' },
  { id: 'food', name: 'Food & Dining', kind: 'expense', icon: 'Utensils', color: '#b45309' },
  { id: 'transport', name: 'Transportation', kind: 'expense', icon: 'Car', color: '#3b6ea5' },
  { id: 'shopping', name: 'Shopping', kind: 'expense', icon: 'ShoppingBag', color: '#9d4b6b' },
  { id: 'entertainment', name: 'Entertainment', kind: 'expense', icon: 'Clapperboard', color: '#6d5aa6' },
  { id: 'health', name: 'Health', kind: 'expense', icon: 'HeartPulse', color: '#b34a3c' },
  { id: 'travel', name: 'Travel', kind: 'expense', icon: 'Plane', color: '#2a8790' },
  { id: 'subscriptions', name: 'Subscriptions', kind: 'expense', icon: 'Repeat', color: '#7a7a45' },
  { id: 'family', name: 'Family', kind: 'expense', icon: 'Users', color: '#a3663a' },
  { id: 'education', name: 'Education', kind: 'expense', icon: 'GraduationCap', color: '#4b6a9d' },
  { id: 'other', name: 'Other', kind: 'expense', icon: 'Ellipsis', color: '#78716c' },
  { id: 'salary', name: 'Salary', kind: 'income', icon: 'Wallet', color: '#166534' },
  { id: 'bonus', name: 'Bonus', kind: 'income', icon: 'Gift', color: '#3f8f5c' },
  { id: 'invest-income', name: 'Investment Income', kind: 'income', icon: 'TrendingUp', color: '#2a8790' },
  { id: 'other-income', name: 'Other Income', kind: 'income', icon: 'CirclePlus', color: '#78716c' },
]
