import { useEffect, useState } from 'react'
import { Plus, Undo2 } from 'lucide-react'
import CategoryIcon from '../components/CategoryIcon'
import { AmountInput, Button, Card, ConfirmButton, cx, EmptyState, Field, Input, Modal, PageHeader, Segmented, Select } from '../components/ui'
import { useDate, useMoney } from '../hooks/useMoney'
import { daysUntilDue, monthlyBillTotal } from '../lib/calc'
import { useStore } from '../store/AppStore'
import type { Bill, BillFrequency } from '../types'

const frequencyLabels: Record<BillFrequency, string> = { weekly: 'Every week', monthly: 'Every month', yearly: 'Every year' }

export function dueLabel(days: number) {
  if (days < 0) return `Overdue ${-days} ${-days === 1 ? 'day' : 'days'}`
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `Due in ${days} days`
}

function BillModal({ bill, onClose }: { bill?: Bill; onClose: () => void }) {
  const { data, today, addBill, updateBill, deleteBill } = useStore()
  const accounts = data.accounts.filter((a) => !a.archived)
  const categories = data.categories.filter((c) => c.kind === 'expense')
  const [name, setName] = useState(bill?.name ?? '')
  const [amount, setAmount] = useState(bill?.amount ?? 0)
  const [categoryId, setCategoryId] = useState(bill?.categoryId ?? categories.find((c) => c.id === 'housing')?.id ?? categories[0]?.id ?? '')
  const [accountId, setAccountId] = useState(bill?.accountId ?? accounts.find((a) => a.type === 'bank' || a.type === 'cash')?.id ?? accounts[0]?.id ?? '')
  const [frequency, setFrequency] = useState<BillFrequency>(bill?.frequency ?? 'monthly')
  const [nextDue, setNextDue] = useState(bill?.nextDue ?? today)

  const missing = !name.trim() ? 'Enter a name.' : amount <= 0 ? 'Enter the amount.' : !accountId ? 'Add an account first (Accounts page).' : !nextDue ? 'Pick the next due date.' : ''

  function save() {
    if (missing) return
    const value = { name: name.trim(), amount, categoryId, accountId, frequency, nextDue }
    if (bill) updateBill(bill.id, bill.nextDue === nextDue ? { ...value, day: bill.day } : value)
    else addBill(value)
    onClose()
  }

  return (
    <Modal title={bill ? 'Edit bill' : 'Add bill'} onClose={onClose} dismissOnBackdrop={false}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <Field label="Bill name">
          <Input data-autofocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Tiền điện, tiền nhà, thuốc…" />
        </Field>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-muted">Amount</span>
          <AmountInput value={amount} onChange={setAmount} />
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-muted">Repeats</span>
          <Segmented
            label="Repeats"
            value={frequency}
            onChange={setFrequency}
            options={(Object.keys(frequencyLabels) as BillFrequency[]).map((f) => ({ value: f, label: f === 'weekly' ? 'Weekly' : f === 'monthly' ? 'Monthly' : 'Yearly' }))}
          />
        </div>
        <Field label="Next due date">
          <Input type="date" value={nextDue} max="9999-12-31" onChange={(e) => setNextDue(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Category">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Paid from">
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </Field>
        </div>
        {missing && <p className="text-sm text-muted">{missing}</p>}
        <Button type="submit" className="min-h-[44px] w-full" disabled={!!missing}>
          {bill ? 'Save changes' : 'Add bill'}
        </Button>
        {bill && (
          <ConfirmButton
            variant="danger"
            className="min-h-[44px] w-full"
            confirmLabel="Tap again to delete this bill"
            onConfirm={() => {
              deleteBill(bill.id)
              onClose()
            }}
          >
            Delete bill
          </ConfirmButton>
        )}
      </form>
    </Modal>
  )
}

export default function Bills() {
  const { data, today, updateBill, markBillPaid, deleteTransaction } = useStore()
  const money = useMoney()
  const fmtDate = useDate()
  const [editing, setEditing] = useState<Bill | 'new' | null>(null)
  const [undo, setUndo] = useState<{ txId: string; bill: Bill; text: string } | null>(null)

  useEffect(() => {
    if (!undo) return
    const t = setTimeout(() => setUndo(null), 10000)
    return () => clearTimeout(t)
  }, [undo])

  const catById = new Map(data.categories.map((c) => [c.id, c]))
  const bills = [...data.bills].sort((a, b) => a.nextDue.localeCompare(b.nextDue) || a.name.localeCompare(b.name))

  function pay(bill: Bill) {
    const txId = markBillPaid(bill.id)
    setUndo({ txId, bill, text: `${bill.name} · ${money(bill.amount)}` })
  }

  function undoPay() {
    if (!undo) return
    deleteTransaction(undo.txId)
    const { id: _id, ...rest } = undo.bill
    updateBill(undo.bill.id, rest)
    setUndo(null)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Bills"
        subtitle="Rent, electricity, medicine… Tap Paid when you pay one and it is added to your spending."
        actions={
          <Button onClick={() => setEditing('new')} className="min-h-[44px]">
            <Plus size={16} /> Add bill
          </Button>
        }
      />

      {bills.length === 0 ? (
        <Card>
          <EmptyState
            title="No bills yet"
            text="Add the payments that repeat (rent, electricity, internet, medicine). The app reminds you on the Home page when one is due."
            action={<Button onClick={() => setEditing('new')} className="min-h-[44px]">Add your first bill</Button>}
          />
        </Card>
      ) : (
        <>
          <p className="mb-3 px-1 text-sm text-muted">
            About <span className="num font-medium text-ink">{money(monthlyBillTotal(bills))}</span> per month in bills
          </p>
          <Card className="divide-y divide-line p-0">
            {bills.map((b) => {
              const days = daysUntilDue(b, today)
              return (
                <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                  <button type="button" onClick={() => setEditing(b)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Edit ${b.name}`}>
                    <CategoryIcon category={catById.get(b.categoryId)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{b.name}</span>
                      <span className={cx('block text-[13px]', days < 0 ? 'font-medium text-neg' : days <= 3 ? 'font-medium text-warn' : 'text-muted')}>
                        {dueLabel(days)} · {fmtDate(b.nextDue)}
                      </span>
                      <span className="block text-[13px] text-muted">{frequencyLabels[b.frequency]}</span>
                    </span>
                    <span className="num text-sm font-medium">{money(b.amount, { mode: 'compact' })}</span>
                  </button>
                  <Button variant="secondary" className="min-h-[44px] shrink-0" onClick={() => pay(b)} aria-label={`Mark ${b.name} as paid`}>
                    Paid
                  </Button>
                </div>
              )
            })}
          </Card>
        </>
      )}

      {undo && (
        <div role="status" className="anim-sheet fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center gap-3 rounded-xl bg-ink px-4 py-3 text-sm text-canvas shadow-lg md:bottom-6">
          <span className="min-w-0 flex-1 truncate">Paid {undo.text}</span>
          <button onClick={undoPay} className="flex min-h-[44px] items-center gap-1 px-2 font-semibold underline">
            <Undo2 size={14} /> Undo
          </button>
        </div>
      )}

      {editing && <BillModal bill={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
