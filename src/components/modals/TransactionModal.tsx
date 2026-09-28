import { useMemo, useState } from 'react'
import { ChevronDown, Trash2 } from 'lucide-react'
import { budgetsForMonth, budgetUsage } from '../../lib/calc'
import { todayStr } from '../../lib/format'
import { useMoney } from '../../hooks/useMoney'
import { useStore } from '../../store/AppStore'
import type { Transaction, TxType } from '../../types'
import CategoryIcon from '../CategoryIcon'
import { AmountInput, Button, cx, Field, Input, Modal, Segmented, Select } from '../ui'

export interface TxDefaults {
  type?: TxType
  accountId?: string
}

export default function TransactionModal({ tx, defaults, onClose }: { tx?: Transaction; defaults?: TxDefaults; onClose: () => void }) {
  const { data, addTransaction, updateTransaction, deleteTransaction } = useStore()
  const money = useMoney()
  const accounts = data.accounts.filter((a) => !a.archived || a.id === tx?.accountId || a.id === tx?.toAccountId)

  const [type, setType] = useState<TxType>(tx?.type ?? defaults?.type ?? 'expense')
  const [amount, setAmount] = useState(tx?.amount ?? 0)
  const [description, setDescription] = useState(tx?.description ?? '')
  const [categoryId, setCategoryId] = useState<string | null>(tx ? tx.categoryId : (data.prefs.lastCategoryId[defaults?.type ?? 'expense'] ?? null))
  const [accountId, setAccountId] = useState(
    tx?.accountId ?? defaults?.accountId ?? data.prefs.lastAccountId[defaults?.type ?? 'expense'] ?? accounts[0]?.id ?? '',
  )
  const [toAccountId, setToAccountId] = useState(tx?.toAccountId ?? '')
  const [date, setDate] = useState(tx?.date ?? todayStr())
  const [notes, setNotes] = useState(tx?.notes ?? '')
  const [merchant, setMerchant] = useState(tx?.merchant ?? '')
  const [tags, setTags] = useState(tx?.tags?.join(', ') ?? '')
  const [more, setMore] = useState(Boolean(tx?.notes || tx?.merchant || tx?.tags?.length))

  const categories = data.categories.filter((c) => c.kind === type)
  const knownDescriptions = useMemo(() => {
    const seen = new Map<string, Transaction>()
    for (const t of data.transactions) if (t.type !== 'transfer') seen.set(t.description.toLowerCase(), t)
    return seen
  }, [data.transactions])

  function changeType(next: TxType) {
    setType(next)
    if (next === 'transfer') {
      setCategoryId(null)
      setToAccountId((cur) => cur || accounts.find((a) => a.id !== accountId)?.id || '')
    } else {
      setCategoryId(data.prefs.lastCategoryId[next] ?? null)
      if (data.prefs.lastAccountId[next]) setAccountId(data.prefs.lastAccountId[next]!)
    }
  }

  function onDescription(value: string) {
    setDescription(value)
    const match = knownDescriptions.get(value.toLowerCase())
    if (match && match.type === type && !categoryId) {
      setCategoryId(match.categoryId)
      setAccountId(match.accountId)
    }
  }

  const budgetHint = useMemo(() => {
    if (type !== 'expense' || !categoryId) return null
    const month = date.slice(0, 7)
    const budget = budgetsForMonth(data.budgets, month).find((b) => b.categoryId === categoryId)
    if (!budget) return null
    const others = data.transactions.filter((t) => t.id !== tx?.id)
    const { remaining } = budgetUsage(budget, others, month)
    return remaining - amount
  }, [type, categoryId, date, amount, data.budgets, data.transactions, tx?.id])

  const valid =
    amount > 0 && date && accountId && (type === 'transfer' ? toAccountId && toAccountId !== accountId : categoryId)

  function save() {
    if (!valid) return
    const category = data.categories.find((c) => c.id === categoryId)
    const payload: Omit<Transaction, 'id'> = {
      type,
      amount,
      date,
      accountId,
      description: description.trim() || (type === 'transfer' ? 'Transfer' : (category?.name ?? '')),
      categoryId: type === 'transfer' ? null : categoryId,
      ...(type === 'transfer' ? { toAccountId } : {}),
      notes: notes.trim() || undefined,
      merchant: merchant.trim() || undefined,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    }
    if (tx) updateTransaction(tx.id, payload)
    else addTransaction(payload)
    onClose()
  }

  function remove() {
    if (tx && confirm('Delete this transaction? Account balances and reports will be updated.')) {
      deleteTransaction(tx.id)
      onClose()
    }
  }

  const activeCategory = data.categories.find((c) => c.id === categoryId)

  return (
    <Modal title={tx ? 'Edit transaction' : 'Add transaction'} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <Segmented
          label="Transaction type"
          value={type}
          onChange={changeType}
          options={[
            { value: 'expense', label: 'Expense' },
            { value: 'income', label: 'Income' },
            { value: 'transfer', label: 'Transfer' },
          ]}
        />

        <AmountInput value={amount} onChange={setAmount} autoFocus />

        {type !== 'transfer' && (
          <>
            <Field label="Description">
              <Input list="known-descriptions" value={description} onChange={(e) => onDescription(e.target.value)} placeholder="Coffee" />
              <datalist id="known-descriptions">
                {[...knownDescriptions.values()].slice(-60).map((t) => (
                  <option key={t.id} value={t.description} />
                ))}
              </datalist>
            </Field>

            <div>
              <span className="mb-1.5 block text-xs font-medium text-muted">Category</span>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Category">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={categoryId === c.id}
                    onClick={() => setCategoryId(c.id)}
                    className={cx(
                      'flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[11px] leading-tight transition-colors',
                      categoryId === c.id ? 'border-accent bg-accent-soft font-medium' : 'border-line hover:bg-soft',
                    )}
                  >
                    <CategoryIcon category={c} />
                    <span className="w-full truncate text-center">{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {type === 'transfer' ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="From account">
              <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="To account">
              <Select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                <option value="">Select…</option>
                {accounts.filter((a) => a.id !== accountId).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            </Field>
            <p className="col-span-2 text-xs text-muted">Transfers move money between accounts and do not count as income or spending.</p>
          </div>
        ) : (
          <Field label="Account">
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </Field>
        )}

        {budgetHint !== null && (
          <p className={cx('rounded-xl px-3 py-2 text-sm', budgetHint >= 0 ? 'bg-accent-soft text-accent' : 'bg-soft text-neg')}>
            {budgetHint >= 0
              ? `${money(budgetHint)} remaining in this month's ${activeCategory?.name} budget`
              : `Over the ${activeCategory?.name} budget by ${money(-budgetHint)}`}
          </p>
        )}

        <Field label="Date">
          <Input type="date" value={date} max="9999-12-31" onChange={(e) => setDate(e.target.value)} />
        </Field>

        <button type="button" onClick={() => setMore(!more)} aria-expanded={more} className="flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ChevronDown size={16} className={cx('transition-transform', more && 'rotate-180')} /> Notes, merchant & tags
        </button>
        {more && (
          <div className="space-y-3">
            <Field label="Notes">
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            {type !== 'transfer' && (
              <Field label="Merchant">
                <Input value={merchant} onChange={(e) => setMerchant(e.target.value)} />
              </Field>
            )}
            <Field label="Tags" hint="Separate with commas">
              <Input value={tags} onChange={(e) => setTags(e.target.value)} />
            </Field>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {tx && (
            <Button type="button" variant="danger" onClick={remove} aria-label="Delete transaction">
              <Trash2 size={16} />
            </Button>
          )}
          <Button type="submit" className="flex-1" disabled={!valid}>
            {tx ? 'Save changes' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
