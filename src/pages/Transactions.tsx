import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, Plus, Search, X } from 'lucide-react'
import { useModals } from '../components/modals/ModalHost'
import { TransactionCards, TransactionTable, type SortKey } from '../components/TransactionTable'
import { Button, Card, EmptyState, Input, PageHeader, Select } from '../components/ui'
import { useMoney } from '../hooks/useMoney'
import { monthEnd, shiftMonth } from '../lib/calc'
import { exportTransactionsCsv } from '../lib/csv'
import { normalizeText } from '../lib/format'
import { useStore } from '../store/AppStore'
import type { TxType } from '../types'

type Range = 'month' | 'last' | '3m' | 'year' | 'all' | 'custom'
const PAGE_SIZE = 25

export default function Transactions() {
  const { data, today } = useStore()
  const { openTransaction } = useModals()
  const money = useMoney()
  const [params] = useSearchParams()

  const [range, setRange] = useState<Range>((params.get('range') as Range) || 'month')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [accountId, setAccountId] = useState(params.get('account') ?? '')
  const [categoryId, setCategoryId] = useState(params.get('category') ?? '')
  const [type, setType] = useState<'' | TxType>((params.get('type') as TxType) || '')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [q, setQ] = useState(params.get('q') ?? '')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' })
  const [page, setPage] = useState(0)

  const month = today.slice(0, 7)
  const bounds = useMemo(() => {
    if (range === 'month') return [`${month}-01`, monthEnd(month)]
    if (range === 'last') return [`${shiftMonth(month, -1)}-01`, monthEnd(shiftMonth(month, -1))]
    if (range === '3m') return [`${shiftMonth(month, -2)}-01`, monthEnd(month)]
    if (range === 'year') return [`${today.slice(0, 4)}-01-01`, `${today.slice(0, 4)}-12-31`]
    if (range === 'custom') return [from || '0000-01-01', to || '9999-12-31']
    return ['0000-01-01', '9999-12-31']
  }, [range, month, today, from, to])

  const { rows, income, expenses } = useMemo(() => {
    const cats = new Map(data.categories.map((c) => [c.id, c.name]))
    const accs = new Map(data.accounts.map((a) => [a.id, a.name]))
    const term = normalizeText(q.trim())
    const min = Number(minAmount.replace(/\D/g, '')) || 0
    const max = Number(maxAmount.replace(/\D/g, '')) || Infinity

    const filtered = data.transactions.filter((t) => {
      if (t.date < bounds[0] || t.date > bounds[1]) return false
      if (type && t.type !== type) return false
      if (accountId && t.accountId !== accountId && t.toAccountId !== accountId) return false
      if (categoryId && t.categoryId !== categoryId) return false
      if (t.amount < min || t.amount > max) return false
      if (term) {
        const hay = [t.description, t.merchant, t.notes, t.categoryId && cats.get(t.categoryId), accs.get(t.accountId), ...(t.tags ?? [])]
        if (!hay.some((v) => v && normalizeText(v).includes(term))) return false
      }
      return true
    })

    const value = (t: (typeof filtered)[number]) => {
      switch (sort.key) {
        case 'description': return t.description.toLowerCase()
        case 'category': return t.type === 'transfer' ? 'transfer' : (cats.get(t.categoryId ?? '') ?? '').toLowerCase()
        case 'account': return (accs.get(t.accountId) ?? '').toLowerCase()
        case 'amount': return t.amount
        default: return t.date
      }
    }
    const dir = sort.dir === 'asc' ? 1 : -1
    filtered.sort((a, b) => {
      const va = value(a)
      const vb = value(b)
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return cmp * dir || b.date.localeCompare(a.date) || b.id.localeCompare(a.id)
    })

    let inc = 0
    let exp = 0
    for (const t of filtered) {
      if (t.type === 'income') inc += t.amount
      else if (t.type === 'expense') exp += t.amount
    }
    return { rows: filtered, income: inc, expenses: exp }
  }, [data, bounds, type, accountId, categoryId, minAmount, maxAmount, q, sort])

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const pageRows = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)
  const filtersActive = Boolean(accountId || categoryId || type || minAmount || maxAmount || q)

  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setPage(0)
  }

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'date' || key === 'amount' ? 'desc' : 'asc' }))
  }

  function clearFilters() {
    setAccountId('')
    setCategoryId('')
    setType('')
    setMinAmount('')
    setMaxAmount('')
    setQ('')
    setPage(0)
  }

  return (
    <div>
      <PageHeader
        title="Transactions"
        subtitle={`${rows.length} transaction${rows.length === 1 ? '' : 's'}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => exportTransactionsCsv(rows, data.categories, data.accounts)} disabled={!rows.length}>
              <Download size={15} /> Export CSV
            </Button>
            <Button onClick={() => openTransaction()}>
              <Plus size={16} /> Add Transaction
            </Button>
          </>
        }
      />

      <Card className="mb-4 space-y-3 p-4">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input aria-label="Search transactions" className="pl-9" placeholder="Search description, merchant, notes…" value={q} onChange={(e) => reset(setQ)(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
          <Select aria-label="Date range" value={range} onChange={(e) => reset(setRange)(e.target.value as Range)}>
            <option value="month">This month</option>
            <option value="last">Last month</option>
            <option value="3m">Last 3 months</option>
            <option value="year">This year</option>
            <option value="all">All time</option>
            <option value="custom">Custom range</option>
          </Select>
          <Select aria-label="Account" value={accountId} onChange={(e) => reset(setAccountId)(e.target.value)}>
            <option value="">All accounts</option>
            {data.accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
          <Select aria-label="Category" value={categoryId} onChange={(e) => reset(setCategoryId)(e.target.value)}>
            <option value="">All categories</option>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Select aria-label="Type" value={type} onChange={(e) => reset(setType)(e.target.value as '' | TxType)}>
            <option value="">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="transfer">Transfer</option>
          </Select>
          <Input aria-label="Minimum amount" inputMode="numeric" placeholder="Min amount" value={minAmount} onChange={(e) => reset(setMinAmount)(e.target.value)} />
          <Input aria-label="Maximum amount" inputMode="numeric" placeholder="Max amount" value={maxAmount} onChange={(e) => reset(setMaxAmount)(e.target.value)} />
        </div>
        {range === 'custom' && (
          <div className="grid grid-cols-2 gap-2 md:max-w-md">
            <Input aria-label="From date" type="date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} />
            <Input aria-label="To date" type="date" value={to} onChange={(e) => reset(setTo)(e.target.value)} />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <span className="text-muted">Income <span className="num font-medium text-pos">+{money(income)}</span></span>
          <span className="text-muted">Spending <span className="num font-medium text-neg">-{money(expenses)}</span></span>
          <span className="text-xs text-muted">Transfers are not counted</span>
          {filtersActive && (
            <button onClick={clearFilters} className="ml-auto inline-flex items-center gap-1 text-accent hover:underline">
              <X size={13} /> Clear filters
            </button>
          )}
        </div>
      </Card>

      <Card className="px-4 py-2 md:px-2">
        {rows.length === 0 ? (
          filtersActive || data.transactions.length > 0 ? (
            <EmptyState
              title="No matching transactions"
              text="Try a different date range or clear some filters."
              action={<Button variant="secondary" onClick={() => { clearFilters(); setRange('all') }}>Show everything</Button>}
            />
          ) : (
            <EmptyState
              title="No transactions yet"
              text="Add your first transaction to start tracking your cash flow."
              action={<Button onClick={() => openTransaction()}><Plus size={16} /> Add Transaction</Button>}
            />
          )
        ) : (
          <>
            <TransactionTable rows={pageRows} sort={sort} onSort={toggleSort} showNotes />
            <TransactionCards rows={pageRows} />
          </>
        )}
      </Card>

      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
          <Button variant="secondary" disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft size={15} /> Previous</Button>
          <span className="text-muted">Page {current + 1} of {pages}</span>
          <Button variant="secondary" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next <ChevronRight size={15} /></Button>
        </nav>
      )}
    </div>
  )
}
