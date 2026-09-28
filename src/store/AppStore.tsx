import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { buildDemoData, buildEmptyData } from '../data/demo'
import { computeBalances, totalsFromBalances } from '../lib/calc'
import { todayStr } from '../lib/format'
import { uid } from '../lib/ids'
import { loadData, saveData } from '../lib/storage'
import type { Account, AppData, Budget, Plan, Settings, Transaction } from '../types'

type NewTransaction = Omit<Transaction, 'id'>
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
  dismissInsight: (id: string) => void
  updateSettings: (patch: Partial<Settings>) => void
  resetDemo: () => void
  clearAll: () => void
  importData: (data: AppData) => void
}

const StoreContext = createContext<Store>(null!)
export const useStore = () => useContext(StoreContext)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [today] = useState(todayStr)
  const [data, setData] = useState<AppData>(() => loadData() ?? buildDemoData(today))

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

  const dismissInsight = useCallback((id: string) => {
    setData((d) => ({ ...d, dismissedInsights: [...d.dismissedInsights, id] }))
  }, [])

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }))
  }, [])

  const resetDemo = useCallback(() => setData((d) => ({ ...buildDemoData(todayStr()), settings: d.settings })), [])
  const clearAll = useCallback(() => setData((d) => buildEmptyData(d)), [])
  const importData = useCallback((next: AppData) => setData(next), [])

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
      dismissInsight,
      updateSettings,
      resetDemo,
      clearAll,
      importData,
    }),
    [data, today, balances, totals, addTransaction, updatePlan, updateTransaction, deleteTransaction, addAccount, updateAccount, archiveAccount, adjustBalance, setBudget, dismissInsight, updateSettings, resetDemo, clearAll, importData],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
