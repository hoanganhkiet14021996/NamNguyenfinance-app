import { useEffect, useMemo, useRef, useState } from 'react'
import { getDaysInMonth, parseISO } from 'date-fns'
import { ChevronDown, Undo2 } from 'lucide-react'
import CategoryIcon from '../components/CategoryIcon'
import { useModals } from '../components/modals/ModalHost'
import { Card, cx, Delta, Input, Progress, Segmented, Select } from '../components/ui'
import { useDate, useMoney } from '../hooks/useMoney'
import { monthlyLimit, monthSummary, shiftMonth } from '../lib/calc'
import { greeting } from '../lib/format'
import { useStore } from '../store/AppStore'
import type { Category } from '../types'

const TOP_COUNT = 7

export default function Home() {
  const { data, today, addTransaction, deleteTransaction } = useStore()
  const { openTransaction } = useModals()
  const money = useMoney()
  const fmtDate = useDate()
  const amountRef = useRef<HTMLInputElement>(null)

  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [amount, setAmount] = useState(0)
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today)
  const [accountId, setAccountId] = useState('')
  const [details, setDetails] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [hint, setHint] = useState(false)
  const [toast, setToast] = useState<{ id: string; text: string } | null>(null)

  const accounts = data.accounts.filter((a) => !a.archived)
  const activeAccountId =
    accounts.find((a) => a.id === accountId)?.id ??
    accounts.find((a) => a.id === data.prefs.lastAccountId[type])?.id ??
    accounts.find((a) => a.type === 'bank' || a.type === 'cash')?.id ??
    accounts[0]?.id ??
    ''

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(t)
  }, [toast])

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const t of data.transactions) if (t.type === type && t.categoryId) counts.set(t.categoryId, (counts.get(t.categoryId) ?? 0) + 1)
    return data.categories.filter((c) => c.kind === type).sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
  }, [data.categories, data.transactions, type])
  const visible = showAll ? categories : categories.slice(0, TOP_COUNT)

  const month = today.slice(0, 7)
  const day = Number(today.slice(8))
  const daysInMonth = getDaysInMonth(parseISO(today))
  const spent = monthSummary(data.transactions, month).expenses
  const lastMonthSame = monthSummary(data.transactions, shiftMonth(month, -1), day).expenses
  const limit = monthlyLimit(data.plan, data.budgets, month)
  const daysLeft = daysInMonth - day + 1
  const recent = useMemo(
    () => [...data.transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 5),
    [data.transactions],
  )
  const catById = new Map(data.categories.map((c) => [c.id, c]))

  function save(category: Category) {
    if (amount <= 0) {
      setHint(true)
      amountRef.current?.focus()
      return
    }
    if (!activeAccountId) return
    const id = addTransaction({
      type,
      amount,
      date,
      accountId: activeAccountId,
      categoryId: category.id,
      description: note.trim() || category.name,
    })
    setToast({ id, text: `${type === 'income' ? '+' : '-'}${money(amount)} · ${category.name}` })
    setAmount(0)
    setNote('')
    setDate(today)
    setHint(false)
    amountRef.current?.focus()
  }

  const accountName = accounts.find((a) => a.id === activeAccountId)?.name

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">
          {greeting()}, {data.settings.name}
        </h1>
      </header>

      <Card className="p-5">
        <p className="text-xs font-medium text-muted">Spent this month</p>
        <p className="num mt-1 text-4xl font-semibold tracking-tight">{money(spent)}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
          <span>Day {day} of {daysInMonth}</span>
          {lastMonthSame > 0 && (
            <span className="flex items-center gap-1">
              <Delta value={spent - lastMonthSame} format={(n) => money(n, { mode: 'compact' })} suffix=" vs same days last month" />
            </span>
          )}
        </div>
        {limit > 0 && (
          <div className="mt-4 space-y-2">
            <Progress ratio={spent / limit} tone={spent > limit ? 'neg' : spent / limit >= 0.8 ? 'warn' : 'accent'} label="Monthly budget used" />
            <p className="num text-xs text-muted">
              {spent > limit ? (
                <span className="font-medium text-neg">Over budget by {money(spent - limit)}</span>
              ) : (
                <>
                  <span className="font-medium text-ink">{money(limit - spent, { mode: 'compact' })} left</span> of {money(limit, { mode: 'compact' })} · about{' '}
                  {money((limit - spent) / daysLeft, { mode: 'compact' })}/day for {daysLeft} more days
                </>
              )}
            </p>
          </div>
        )}
      </Card>

      <Card className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-medium">Quick add</h2>
          <Segmented
            label="Transaction type"
            value={type}
            onChange={(v) => {
              setType(v)
              setShowAll(false)
            }}
            options={[
              { value: 'expense', label: 'Expense' },
              { value: 'income', label: 'Income' },
            ]}
          />
        </div>

        <div className={cx('flex items-center gap-2 rounded-xl border px-4 py-3 focus-within:border-accent', hint ? 'border-neg' : 'border-line')}>
          <input
            ref={amountRef}
            autoFocus
            inputMode="numeric"
            enterKeyHint="done"
            aria-label="Amount"
            placeholder="0"
            className="num min-w-0 flex-1 bg-transparent text-4xl font-semibold outline-none placeholder:text-muted/40"
            value={amount ? amount.toLocaleString('en-US') : ''}
            onChange={(e) => {
              setAmount(Number(e.target.value.replace(/\D/g, '').slice(0, 12)) || 0)
              setHint(false)
            }}
          />
          <button
            type="button"
            onClick={() => setAmount((a) => Math.min((a || 0) * 1000, 999_999_999_999))}
            className="rounded-lg bg-soft px-3 py-2 text-sm font-semibold text-muted active:bg-line"
            aria-label="Add three zeros"
          >
            000
          </button>
        </div>
        {hint && <p role="alert" className="-mt-2 text-xs text-neg">Enter an amount first, then tap a category.</p>}

        <div>
          <p className="mb-2 text-xs font-medium text-muted">Tap a category to save</p>
          <div className="grid grid-cols-4 gap-2" role="group" aria-label="Category">
            {visible.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => save(c)}
                className="flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl border border-line px-1 py-2 text-[11px] leading-tight transition-colors active:scale-[0.97] active:bg-accent-soft hover:bg-soft"
              >
                <CategoryIcon category={c} />
                <span className="w-full truncate text-center">{c.name}</span>
              </button>
            ))}
            {categories.length > TOP_COUNT && (
              <button
                type="button"
                onClick={() => setShowAll(!showAll)}
                className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line text-[11px] text-muted hover:bg-soft"
              >
                <ChevronDown size={16} className={cx('transition-transform', showAll && 'rotate-180')} />
                {showAll ? 'Less' : 'More'}
              </button>
            )}
          </div>
        </div>

        <div>
          <button type="button" onClick={() => setDetails(!details)} aria-expanded={details} className="flex items-center gap-1 text-xs text-muted hover:text-ink">
            <ChevronDown size={14} className={cx('transition-transform', details && 'rotate-180')} />
            {accountName ?? 'No account'} · {date === today ? 'Today' : fmtDate(date)} · {note ? 'Note added' : 'Add a note'}
          </button>
          {details && (
            <div className="mt-3 space-y-3">
              <Input placeholder="Note (optional)" aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <Select aria-label="Account" value={activeAccountId} onChange={(e) => setAccountId(e.target.value)}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </Select>
                <Input type="date" aria-label="Date" value={date} max="9999-12-31" onChange={(e) => setDate(e.target.value || today)} />
              </div>
            </div>
          )}
        </div>
        {accounts.length === 0 && <p className="text-sm text-warn">Add an account first (Accounts page) to record transactions.</p>}
      </Card>

      {toast && (
        <div role="status" className="anim-sheet fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center gap-3 rounded-xl bg-ink px-4 py-3 text-sm text-canvas shadow-lg md:bottom-6">
          <span className="min-w-0 flex-1 truncate">Saved {toast.text}</span>
          <button
            onClick={() => {
              deleteTransaction(toast.id)
              setToast(null)
            }}
            className="flex items-center gap-1 font-semibold underline"
          >
            <Undo2 size={14} /> Undo
          </button>
        </div>
      )}

      {recent.length > 0 && (
        <section aria-label="Recent">
          <h2 className="mb-2 px-1 text-xs font-medium text-muted">Recent</h2>
          <Card className="divide-y divide-line p-0">
            {recent.map((t) => (
              <button key={t.id} onClick={() => openTransaction(t)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <CategoryIcon category={catById.get(t.categoryId ?? '')} transfer={t.type === 'transfer'} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{t.description}</span>
                  <span className="block text-xs text-muted">{fmtDate(t.date)}</span>
                </span>
                <span className={cx('num text-sm font-medium', t.type === 'income' ? 'text-pos' : t.type === 'expense' ? 'text-neg' : 'text-muted')}>
                  {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : '⇄ '}
                  {money(t.amount, { mode: 'compact' })}
                </span>
              </button>
            ))}
          </Card>
        </section>
      )}
    </div>
  )
}
