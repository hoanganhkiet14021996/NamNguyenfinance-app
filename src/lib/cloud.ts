import { buildEmptyData } from '../data/demo'
import type { Account, AppData, Bill, Budget, Category, Goal, Transaction } from '../types'
import { supabase } from './supabase'

const PAGE = 1000 // Supabase returns at most 1000 rows per request
const CHUNK = 500

type Row = Record<string, unknown>

async function fetchAll(table: string, order: string[]): Promise<Row[]> {
  const out: Row[] = []
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from(table).select('*')
    for (const col of order) q = q.order(col)
    const { data, error } = await q.range(from, from + PAGE - 1)
    if (error) throw error
    out.push(...(data as Row[]))
    if (data.length < PAGE) return out
  }
}

/** Like fetchAll, but a table that does not exist yet (schema.sql not re-run) just reads as empty. */
async function fetchOptional(table: string, order: string[]): Promise<Row[]> {
  try {
    return await fetchAll(table, order)
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === '42P01' || code === 'PGRST205') return []
    throw e
  }
}

const str = (v: unknown) => (v == null ? undefined : String(v))

/** Load this user's data. Returns null when nothing has been saved to the cloud yet. */
export async function pullData(): Promise<AppData | null> {
  const meta = await supabase.from('fin_settings').select('*').maybeSingle()
  if (meta.error) throw meta.error
  if (!meta.data) return null

  const [accounts, categories, transactions, budgets, bills, goals] = await Promise.all([
    fetchAll('fin_accounts', ['name', 'id']),
    fetchAll('fin_categories', ['name', 'id']),
    fetchAll('fin_transactions', ['date', 'id']),
    fetchAll('fin_budgets', ['id']),
    fetchOptional('fin_bills', ['next_due', 'id']),
    fetchOptional('fin_goals', ['created_at', 'id']),
  ])

  const base = buildEmptyData()
  return {
    ...base,
    settings: { ...base.settings, ...(meta.data.settings as object) },
    prefs: { ...base.prefs, ...(meta.data.prefs as object) },
    plan: { ...base.plan, ...(meta.data.plan as object) },
    dismissedInsights: (meta.data.dismissed_insights as string[]) ?? [],
    accounts: accounts.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      institution: (r.institution as string) ?? '',
      type: r.type as Account['type'],
      openingBalance: Number(r.opening_balance),
      archived: Boolean(r.archived),
      updatedAt: (r.updated_at as string) ?? '',
    })),
    categories: categories.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      kind: r.kind as Category['kind'],
      icon: r.icon as string,
      color: r.color as string,
    })),
    transactions: transactions.map((r) => {
      const tags = r.tags as string[] | null
      return {
        id: r.id as string,
        type: r.type as Transaction['type'],
        date: r.date as string,
        amount: Number(r.amount),
        description: (r.description as string) ?? '',
        categoryId: (r.category_id as string | null) ?? null,
        accountId: r.account_id as string,
        toAccountId: str(r.to_account_id),
        notes: str(r.notes),
        merchant: str(r.merchant),
        tags: tags?.length ? tags : undefined,
      }
    }),
    budgets: budgets.map((r) => ({
      id: r.id as string,
      month: r.month as string,
      categoryId: r.category_id as string,
      amount: Number(r.amount),
    })),
    bills: bills.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      amount: Number(r.amount),
      categoryId: r.category_id as string,
      accountId: r.account_id as string,
      frequency: r.frequency as Bill['frequency'],
      nextDue: r.next_due as string,
      day: Number(r.day),
    })),
    goals: goals.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      target: Number(r.target),
      saved: Number(r.saved),
      deadline: str(r.deadline),
      createdAt: (r.created_at as string) ?? '',
    })),
  }
}

interface Collection<T extends { id: string }> {
  table: string
  prev: T[]
  next: T[]
  toRow: (item: T, userId: string) => Row
}

async function pushCollection<T extends { id: string }>(userId: string, { table, prev, next, toRow }: Collection<T>) {
  const before = new Map(prev.map((x) => [x.id, JSON.stringify(x)]))
  const after = new Set<string>()
  const changed: T[] = []
  for (const item of next) {
    after.add(item.id)
    if (before.get(item.id) !== JSON.stringify(item)) changed.push(item)
  }
  const removed = prev.filter((x) => !after.has(x.id)).map((x) => x.id)

  for (let i = 0; i < changed.length; i += CHUNK) {
    const rows = changed.slice(i, i + CHUNK).map((x) => toRow(x, userId))
    const { error } = await supabase.from(table).upsert(rows, { onConflict: 'user_id,id' })
    if (error) throw error
  }
  for (let i = 0; i < removed.length; i += CHUNK) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId).in('id', removed.slice(i, i + CHUNK))
    if (error) throw error
  }
}

/** Send only what changed between `prev` (what the cloud has) and `next`. `prev = null` means the cloud is empty. */
export async function pushChanges(userId: string, prev: AppData | null, next: AppData) {
  const was = prev ?? { ...buildEmptyData(), accounts: [], categories: [], transactions: [], budgets: [], bills: [], goals: [] }

  await pushCollection<Account>(userId, {
    table: 'fin_accounts',
    prev: was.accounts,
    next: next.accounts,
    toRow: (a, user_id) => ({
      user_id,
      id: a.id,
      name: a.name,
      institution: a.institution,
      type: a.type,
      opening_balance: a.openingBalance,
      archived: a.archived,
      updated_at: a.updatedAt,
    }),
  })
  await pushCollection<Category>(userId, {
    table: 'fin_categories',
    prev: was.categories,
    next: next.categories,
    toRow: (c, user_id) => ({ user_id, id: c.id, name: c.name, kind: c.kind, icon: c.icon, color: c.color }),
  })
  await pushCollection<Transaction>(userId, {
    table: 'fin_transactions',
    prev: was.transactions,
    next: next.transactions,
    toRow: (t, user_id) => ({
      user_id,
      id: t.id,
      type: t.type,
      date: t.date,
      amount: t.amount,
      description: t.description,
      category_id: t.categoryId,
      account_id: t.accountId,
      to_account_id: t.toAccountId ?? null,
      notes: t.notes ?? null,
      merchant: t.merchant ?? null,
      tags: t.tags ?? [],
    }),
  })
  await pushCollection<Budget>(userId, {
    table: 'fin_budgets',
    prev: was.budgets,
    next: next.budgets,
    toRow: (b, user_id) => ({ user_id, id: b.id, month: b.month, category_id: b.categoryId, amount: b.amount }),
  })
  await pushCollection<Bill>(userId, {
    table: 'fin_bills',
    prev: was.bills,
    next: next.bills,
    toRow: (b, user_id) => ({
      user_id,
      id: b.id,
      name: b.name,
      amount: b.amount,
      category_id: b.categoryId,
      account_id: b.accountId,
      frequency: b.frequency,
      next_due: b.nextDue,
      day: b.day,
    }),
  })
  await pushCollection<Goal>(userId, {
    table: 'fin_goals',
    prev: was.goals,
    next: next.goals,
    toRow: (g, user_id) => ({ user_id, id: g.id, name: g.name, target: g.target, saved: g.saved, deadline: g.deadline ?? null, created_at: g.createdAt }),
  })

  const metaOf = (d: AppData) => JSON.stringify([d.settings, d.prefs, d.plan, d.dismissedInsights])
  if (prev === null || metaOf(prev) !== metaOf(next)) {
    const { error } = await supabase.from('fin_settings').upsert(
      {
        user_id: userId,
        settings: next.settings,
        prefs: next.prefs,
        plan: next.plan,
        dismissed_insights: next.dismissedInsights,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    if (error) throw error
  }
}
