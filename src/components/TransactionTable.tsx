import { ArrowDown, ArrowUp } from 'lucide-react'
import { useDate, useMoney } from '../hooks/useMoney'
import { shortDate } from '../lib/format'
import { useStore } from '../store/AppStore'
import type { Transaction } from '../types'
import CategoryIcon from './CategoryIcon'
import { useModals } from './modals/ModalHost'
import { cx } from './ui'

export type SortKey = 'date' | 'description' | 'category' | 'account' | 'amount'

function useLookups() {
  const { data } = useStore()
  const cats = new Map(data.categories.map((c) => [c.id, c]))
  const accs = new Map(data.accounts.map((a) => [a.id, a]))
  return { cats, accs }
}

export function TxAmount({ tx, className }: { tx: Transaction; className?: string }) {
  const money = useMoney()
  if (tx.type === 'transfer') return <span className={cx('num text-muted', className)}>⇄ {money(tx.amount)}</span>
  const income = tx.type === 'income'
  return (
    <span className={cx('num font-medium', income ? 'text-pos' : 'text-neg', className)}>
      {income ? '+' : '-'}
      {money(tx.amount)}
    </span>
  )
}

function accountLabel(tx: Transaction, accs: ReturnType<typeof useLookups>['accs']) {
  const from = accs.get(tx.accountId)?.name ?? 'Unknown'
  return tx.type === 'transfer' ? `${from} → ${accs.get(tx.toAccountId ?? '')?.name ?? 'Unknown'}` : from
}

export function TransactionCards({ rows }: { rows: Transaction[] }) {
  const { cats, accs } = useLookups()
  const { openTransaction } = useModals()
  const fmtDate = useDate()
  return (
    <ul className="divide-y divide-line md:hidden">
      {rows.map((tx) => (
        <li key={tx.id}>
          <button onClick={() => openTransaction(tx)} className="flex w-full items-center gap-3 py-3 text-left">
            <CategoryIcon category={cats.get(tx.categoryId ?? '')} transfer={tx.type === 'transfer'} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{tx.description}</span>
              <span className="block truncate text-xs text-muted">
                {fmtDate(tx.date)} · {tx.type === 'transfer' ? accountLabel(tx, accs) : `${cats.get(tx.categoryId ?? '')?.name ?? 'Uncategorized'} · ${accs.get(tx.accountId)?.name ?? ''}`}
              </span>
            </span>
            <TxAmount tx={tx} className="text-sm" />
          </button>
        </li>
      ))}
    </ul>
  )
}

interface TableProps {
  rows: Transaction[]
  sort?: { key: SortKey; dir: 'asc' | 'desc' }
  onSort?: (key: SortKey) => void
  showNotes?: boolean
  short?: boolean
}

export function TransactionTable({ rows, sort, onSort, showNotes, short }: TableProps) {
  const { cats, accs } = useLookups()
  const { openTransaction } = useModals()
  const fmtDate = useDate()

  const head = (key: SortKey, label: string, right?: boolean) => {
    const active = sort?.key === key
    const ariaSort = active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none'
    return (
      <th scope="col" aria-sort={onSort ? ariaSort : undefined} className={cx('px-3 py-2.5 text-xs font-medium text-muted', right ? 'text-right' : 'text-left')}>
        {onSort ? (
          <button onClick={() => onSort(key)} className={cx('inline-flex items-center gap-1 hover:text-ink', active && 'text-ink')}>
            {label}
            {active && (sort!.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
          </button>
        ) : (
          label
        )}
      </th>
    )
  }

  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full text-sm">
        <thead className="border-b border-line">
          <tr>
            {head('date', 'Date')}
            {head('description', 'Description')}
            {head('category', 'Category')}
            {head('account', 'Account')}
            {head('amount', 'Amount', true)}
            {showNotes && <th scope="col" className="px-3 py-2.5 text-left text-xs font-medium text-muted">Notes</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((tx) => (
            <tr key={tx.id} onClick={() => openTransaction(tx)} className="cursor-pointer transition-colors hover:bg-soft">
              <td className="num whitespace-nowrap px-3 text-muted" style={{ paddingBlock: 'var(--row-y)' }}>
                {short ? shortDate(tx.date) : fmtDate(tx.date)}
              </td>
              <td className="max-w-[260px] px-3" style={{ paddingBlock: 'var(--row-y)' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    openTransaction(tx)
                  }}
                  className="block max-w-full truncate text-left font-medium"
                >
                  {tx.description}
                </button>
              </td>
              <td className="px-3" style={{ paddingBlock: 'var(--row-y)' }}>
                <span className="inline-flex items-center gap-2">
                  <CategoryIcon category={cats.get(tx.categoryId ?? '')} transfer={tx.type === 'transfer'} size={13} />
                  <span className="text-muted">{tx.type === 'transfer' ? 'Transfer' : (cats.get(tx.categoryId ?? '')?.name ?? 'Uncategorized')}</span>
                </span>
              </td>
              <td className="whitespace-nowrap px-3 text-muted" style={{ paddingBlock: 'var(--row-y)' }}>{accountLabel(tx, accs)}</td>
              <td className="whitespace-nowrap px-3 text-right" style={{ paddingBlock: 'var(--row-y)' }}>
                <TxAmount tx={tx} />
              </td>
              {showNotes && (
                <td className="max-w-[200px] truncate px-3 text-muted" style={{ paddingBlock: 'var(--row-y)' }}>{tx.notes}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
