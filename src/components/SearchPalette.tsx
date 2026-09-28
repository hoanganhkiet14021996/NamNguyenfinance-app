import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Landmark, Search, Tag } from 'lucide-react'
import { useDate, useMoney } from '../hooks/useMoney'
import { useStore } from '../store/AppStore'
import CategoryIcon from './CategoryIcon'
import { useModals } from './modals/ModalHost'
import { Modal } from './ui'

export default function SearchPalette({ onClose }: { onClose: () => void }) {
  const { data } = useStore()
  const { openTransaction } = useModals()
  const navigate = useNavigate()
  const money = useMoney()
  const fmtDate = useDate()
  const [q, setQ] = useState('')
  const term = q.trim().toLowerCase()

  const results = useMemo(() => {
    if (!term) return null
    const catName = new Map(data.categories.map((c) => [c.id, c.name]))
    const accName = new Map(data.accounts.map((a) => [a.id, a.name]))
    const txs = data.transactions
      .filter((t) =>
        [t.description, t.merchant, t.notes, t.categoryId && catName.get(t.categoryId), accName.get(t.accountId), ...(t.tags ?? [])]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(term)),
      )
      .sort((a, b) => b.date.localeCompare(a.date))
    return {
      txs,
      accounts: data.accounts.filter((a) => `${a.name} ${a.institution}`.toLowerCase().includes(term)),
      categories: data.categories.filter((c) => c.name.toLowerCase().includes(term)),
    }
  }, [term, data])

  const go = (to: string) => {
    onClose()
    navigate(to)
  }

  const empty = results && !results.txs.length && !results.accounts.length && !results.categories.length

  return (
    <Modal title="Search" onClose={onClose} wide>
      <div className="flex items-center gap-2 rounded-xl border border-line px-3 focus-within:border-accent">
        <Search size={16} className="text-muted" />
        <input
          data-autofocus
          aria-label="Search transactions, accounts and categories"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && term) go(`/transactions?q=${encodeURIComponent(q.trim())}&range=all`)
          }}
          placeholder="Search transactions, accounts, categories…"
          className="w-full bg-transparent py-3 text-sm outline-none"
        />
      </div>

      <div className="mt-4 min-h-40 space-y-4">
        {!results && <p className="py-8 text-center text-sm text-muted">Try "Grab", "Techcombank" or "Food". Press Enter to see all matching transactions.</p>}
        {empty && <p className="py-8 text-center text-sm text-muted">No results for "{q}".</p>}

        {results && results.txs.length > 0 && (
          <div>
            <div className="mb-1 flex items-center justify-between text-xs font-medium text-muted">
              <span>Transactions ({results.txs.length})</span>
              <button className="text-accent hover:underline" onClick={() => go(`/transactions?q=${encodeURIComponent(q.trim())}&range=all`)}>
                See all
              </button>
            </div>
            {results.txs.slice(0, 5).map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  onClose()
                  openTransaction(t)
                }}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-soft"
              >
                <CategoryIcon category={data.categories.find((c) => c.id === t.categoryId)} transfer={t.type === 'transfer'} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{t.description}</span>
                  <span className="block text-xs text-muted">{fmtDate(t.date)}</span>
                </span>
                <span className="num text-sm">{money(t.type === 'expense' ? -t.amount : t.amount)}</span>
              </button>
            ))}
          </div>
        )}

        {results && results.accounts.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-muted">Accounts</p>
            {results.accounts.map((a) => (
              <button key={a.id} onClick={() => go(`/accounts/${a.id}`)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-soft">
                <Landmark size={16} className="text-muted" />
                <span className="text-sm">{a.name}</span>
              </button>
            ))}
          </div>
        )}

        {results && results.categories.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-muted">Categories</p>
            {results.categories.map((c) => (
              <button key={c.id} onClick={() => go(`/transactions?category=${c.id}&range=all`)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-soft">
                <Tag size={16} className="text-muted" />
                <span className="text-sm">{c.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
