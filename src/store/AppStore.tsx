import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { upgradeCategories } from '../data/categories'
import { buildDemoData, buildEmptyData } from '../data/demo'
import { computeBalances, nextDueAfterPaying, totalsFromBalances } from '../lib/calc'
import { todayStr } from '../lib/format'
import { uid } from '../lib/ids'
import { loadData, saveData } from '../lib/storage'
import { useCloudSync, type SyncStatus } from '../lib/useCloudSync'
import type { Account, AppData, Bill, Budget, Goal, Plan, Settings, Transaction } from '../types'

type NewTransaction = Omit<Transaction, 'id'>
type NewBill = Omit<Bill, 'id' | 'day'> & { day?: number }
type NewGoal = Omit<Goal, 'id' | 'createdAt'>
type NewAccount = Pick<Account, 'name' | 'institution' | 'type' | 'openingBalance'>

interface Store {
  data: AppData
  today: string
  balances: Map<string, number>
  totals: ReturnType<typeof totalsFromBalances>
  addTransaction: (tx: NewTransaction) => string
  updatePlan: (patch: Partial<Plan>) => void
  updateTransaction: (id: string, tx: NewTransaction) => void
  deleteTransaction: (id: string) => void
  addAccount: (a: NewAccount) => string
  updateAccount: (id: string, patch: Partial<Pick<Account, 'name' | 'institution' | 'type'>>) => void
  archiveAccount: (id: string, archived: boolean) => void
  adjustBalance: (id: string, newBalance: number) => void
  setBudget: (b: Omit<Budget, 'id'>) => void
  addBill: (b: NewBill) => void
  updateBill: (id: string, b: NewBill) => void
  deleteBill: (id: string) => void
  /** Records the payment as an expense dated today and moves the bill to its next due date. Returns the new transaction id (for Undo). */
  markBillPaid: (id: string) => string
  addGoal: (g: NewGoal) => void
  updateGoal: (id: string, g: NewGoal) => void
  deleteGoal: (id: string) => void
  addToGoal: (id: string, amount: number) => void
  dismissInsight: (id: string) => void
  updateSettings: (patch: Partial<Settings>) => void
  resetDemo: () => void
  clearAll: () => void
  importData: (data: AppData) => void
  syncStatus: SyncStatus
  retrySync: () => void
}

const StoreContext = createContext<Store>(null!)
export const useStore = () => useContext(StoreContext)

interface StoreProviderProps {
  children: ReactNode
  /** Data loaded from the cloud (or a local copy being migrated). Omit to run local-only. */
  initialData?: AppData
  /** Signed-in user; enables cloud sync. */
  userId?: string
  /** What the cloud already holds; null = nothing yet, so everything is uploaded. */
  baseline?: AppData | null
}

export function StoreProvider({ children, initialData, userId, baseline = null }: StoreProviderProps) {
  const [today] = useState(todayStr)
  const [data, setData] = useState<AppData>(() => upgradeCategories(initialData ?? loadData() ?? buildDemoData(today)))
  const { status: syncStatus, retry: retrySync } = useCloudSync(data, userId, baseline)

  useEffect(() => saveData(data), [data])

  const balances = useMemo(() => computeBalances(data.accounts, data.transactions), [data.accounts, data.transactions])
  const totals = useMemo(() => totalsFromBalances(data.accounts, balances), [data.accounts, balances])

  const touch = (accountIds: (string | undefined)[], accounts: Account[]) =>
    accounts.map((a) => (accountIds.includes(a.id) ? { ...a, updatedAt: todayStr() } : a))

  const withPrefs = (d: AppData, tx: NewTransaction): AppData['prefs'] => ({
    lastAccountId: { ...d.prefs.lastAccountId, [tx.type]: tx.accountId },
    lastCategoryId: tx.categoryId ? { ...d.prefs.lastCategoryId, [tx.type]: tx.categoryId } : d.prefs.lastCategoryId,
  })

  const addTransaction = useCallback((tx: NewTransaction) => {
    const id = uid('tx')
    setData((d) => ({
      ...d,
      transactions: [...d.transactions, { ...tx, id }],
      accounts: touch([tx.accountId, tx.toAccountId], d.accounts),
      prefs: withPrefs(d, tx),
    }))
    return id
  }, [])

  const updatePlan = useCallback((patch: Partial<Plan>) => {
    setData((d) => ({ ...d, plan: { ...d.plan, ...patch } }))
  }, [])

  const updateTransaction = useCallback((id: string, tx: NewTransaction) => {
    setData((d) => ({
      ...d,
      transactions: d.transactions.map((t) => (t.id === id ? { ...tx, id } : t)),
      accounts: touch([tx.accountId, tx.toAccountId], d.accounts),
      prefs: withPrefs(d, tx),
    }))
  }, [])

  const deleteTransaction = useCallback((id: string) => {
    setData((d) => ({ ...d, transactions: d.transactions.filter((t) => t.id !== id) }))
  }, [])

  const addAccount = useCallback((a: NewAccount) => {
    const id = uid('acc')
    setData((d) => ({ ...d, accounts: [...d.accounts, { ...a, id, archived: false, updatedAt: todayStr() }] }))
    return id
  }, [])

  const updateAccount = useCallback((id: string, patch: Partial<Pick<Account, 'name' | 'institution' | 'type'>>) => {
    setData((d) => ({ ...d, accounts: d.accounts.map((a) => (a.id === id ? { ...a, ...patch, updatedAt: todayStr() } : a)) }))
  }, [])

  const archiveAccount = useCallback((id: string, archived: boolean) => {
    setData((d) => ({ ...d, accounts: d.accounts.map((a) => (a.id === id ? { ...a, archived } : a)) }))
  }, [])

  const adjustBalance = useCallback((id: string, newBalance: number) => {
    setData((d) => {
      const current = computeBalances(d.accounts, d.transactions).get(id) ?? 0
      return {
        ...d,
        accounts: d.accounts.map((a) =>
          a.id === id ? { ...a, openingBalance: a.openingBalance + (newBalance - current), updatedAt: todayStr() } : a,
        ),
      }
    })
  }, [])

  const setBudget = useCallback((b: Omit<Budget, 'id'>) => {
    setData((d) => {
      const others = d.budgets.filter((x) => !(x.month === b.month && x.categoryId === b.categoryId))
      return { ...d, budgets: b.amount > 0 ? [...others, { ...b, id: uid('bud') }] : others }
    })
  }, [])

  const addBill = useCallback((b: NewBill) => {
    setData((d) => ({ ...d, bills: [...d.bills, { ...b, id: uid('bill'), day: b.day ?? Number(b.nextDue.slice(8)) }] }))
  }, [])

  const updateBill = useCallback((id: string, b: NewBill) => {
    setData((d) => ({ ...d, bills: d.bills.map((x) => (x.id === id ? { ...b, id, day: b.day ?? Number(b.nextDue.slice(8)) } : x)) }))
  }, [])

  const deleteBill = useCallback((id: string) => {
    setData((d) => ({ ...d, bills: d.bills.filter((x) => x.id !== id) }))
  }, [])

  const markBillPaid = useCallback((id: string) => {
    const txId = uid('tx')
    const date = todayStr()
    setData((d) => {
      const bill = d.bills.find((x) => x.id === id)
      if (!bill) return d
      const tx: Transaction = { id: txId, type: 'expense', date, amount: bill.amount, description: bill.name, categoryId: bill.categoryId, accountId: bill.accountId }
      return {
        ...d,
        transactions: [...d.transactions, tx],
        accounts: touch([bill.accountId], d.accounts),
        bills: d.bills.map((x) => (x.id === id ? { ...x, nextDue: nextDueAfterPaying(x, date) } : x)),
      }
    })
    return txId
  }, [])

  const addGoal = useCallback((g: NewGoal) => {
    setData((d) => ({ ...d, goals: [...d.goals, { ...g, id: uid('goal'), createdAt: todayStr() }] }))
  }, [])

  const updateGoal = useCallback((id: string, g: NewGoal) => {
    setData((d) => ({ ...d, goals: d.goals.map((x) => (x.id === id ? { ...x, ...g } : x)) }))
  }, [])

  const deleteGoal = useCallback((id: string) => {
    setData((d) => ({ ...d, goals: d.goals.filter((x) => x.id !== id) }))
  }, [])

  const addToGoal = useCallback((id: string, amount: number) => {
    setData((d) => ({ ...d, goals: d.goals.map((x) => (x.id === id ? { ...x, saved: x.saved + amount } : x)) }))
  }, [])

  const dismissInsight = useCallback((id: string) => {
    setData((d) => ({ ...d, dismissedInsights: [...d.dismissedInsights, id] }))
  }, [])

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }))
  }, [])

  const resetDemo = useCallback(() => setData((d) => ({ ...buildDemoData(todayStr()), settings: d.settings })), [])
  const clearAll = useCallback(() => setData((d) => buildEmptyData(d)), [])
  const importData = useCallback((next: AppData) => setData(upgradeCategories(next)), [])

  const value = useMemo<Store>(
    () => ({
      data,
      today,
      balances,
      totals,
      addTransaction,
      updatePlan,
      updateTransaction,
      deleteTransaction,
      addAccount,
      updateAccount,
      archiveAccount,
      adjustBalance,
      setBudget,
      addBill,
      updateBill,
      deleteBill,
      markBillPaid,
      addGoal,
      updateGoal,
      deleteGoal,
      addToGoal,
      dismissInsight,
      updateSettings,
      resetDemo,
      clearAll,
      importData,
      syncStatus,
      retrySync,
    }),
    [data, today, balances, totals, addTransaction, updatePlan, updateTransaction, deleteTransaction, addAccount, updateAccount, archiveAccount, adjustBalance, setBudget, addBill, updateBill, deleteBill, markBillPaid, addGoal, updateGoal, deleteGoal, addToGoal, dismissInsight, updateSettings, resetDemo, clearAll, importData, syncStatus, retrySync],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
