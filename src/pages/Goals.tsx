import { useState } from 'react'
import { Plus } from 'lucide-react'
import { AmountInput, Button, Card, ConfirmButton, EmptyState, Field, Input, Modal, PageHeader, Progress } from '../components/ui'
import { useDate, useMoney } from '../hooks/useMoney'
import { goalProgress } from '../lib/calc'
import { pct } from '../lib/format'
import { useStore } from '../store/AppStore'
import type { Goal } from '../types'

function GoalModal({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const { addGoal, updateGoal, deleteGoal } = useStore()
  const [name, setName] = useState(goal?.name ?? '')
  const [target, setTarget] = useState(goal?.target ?? 0)
  const [saved, setSaved] = useState(goal?.saved ?? 0)
  const [deadline, setDeadline] = useState(goal?.deadline ?? '')

  const missing = !name.trim() ? 'Enter a name.' : target <= 0 ? 'Enter how much you want to save.' : ''

  function save() {
    if (missing) return
    const value = { name: name.trim(), target, saved, deadline: deadline || undefined }
    if (goal) updateGoal(goal.id, value)
    else addGoal(value)
    onClose()
  }

  return (
    <Modal title={goal ? 'Edit goal' : 'Add goal'} onClose={onClose} dismissOnBackdrop={false}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <Field label="What are you saving for?">
          <Input data-autofocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Du lịch, xe máy, quỹ khẩn cấp…" />
        </Field>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-muted">Target amount</span>
          <AmountInput value={target} onChange={setTarget} />
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-muted">Saved so far</span>
          <AmountInput value={saved} onChange={setSaved} />
        </div>
        <Field label="Deadline (optional)">
          <Input type="date" value={deadline} max="9999-12-31" onChange={(e) => setDeadline(e.target.value)} />
        </Field>
        {missing && <p className="text-sm text-muted">{missing}</p>}
        <Button type="submit" className="min-h-[44px] w-full" disabled={!!missing}>
          {goal ? 'Save changes' : 'Add goal'}
        </Button>
        {goal && (
          <ConfirmButton
            variant="danger"
            className="min-h-[44px] w-full"
            confirmLabel="Tap again to delete this goal"
            onConfirm={() => {
              deleteGoal(goal.id)
              onClose()
            }}
          >
            Delete goal
          </ConfirmButton>
        )}
      </form>
    </Modal>
  )
}

function AddMoneyModal({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const { addToGoal } = useStore()
  const [amount, setAmount] = useState(0)
  return (
    <Modal title={`Add to ${goal.name}`} onClose={onClose} dismissOnBackdrop={false}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (amount <= 0) return
          addToGoal(goal.id, amount)
          onClose()
        }}
      >
        <p className="text-sm text-muted">This only updates the goal. It does not move money between your accounts.</p>
        <AmountInput value={amount} onChange={setAmount} autoFocus />
        <Button type="submit" className="min-h-[44px] w-full" disabled={amount <= 0}>
          Add money
        </Button>
      </form>
    </Modal>
  )
}

export default function Goals() {
  const { data, today } = useStore()
  const money = useMoney()
  const fmtDate = useDate()
  const [editing, setEditing] = useState<Goal | 'new' | null>(null)
  const [adding, setAdding] = useState<Goal | null>(null)

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Goals"
        subtitle="Things you are saving for. Add money whenever you set some aside."
        actions={
          <Button onClick={() => setEditing('new')} className="min-h-[44px]">
            <Plus size={16} /> Add goal
          </Button>
        }
      />

      {data.goals.length === 0 ? (
        <Card>
          <EmptyState
            title="No goals yet"
            text="Pick something to save for, set the amount, and track your progress here."
            action={<Button onClick={() => setEditing('new')} className="min-h-[44px]">Add your first goal</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {data.goals.map((g) => {
            const p = goalProgress(g, today)
            return (
              <Card key={g.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-[15px] font-medium">{g.name}</h2>
                    <p className="num mt-0.5 text-sm text-muted">
                      {money(g.saved)} of {money(g.target)}
                    </p>
                  </div>
                  <span className="num text-lg font-semibold">{pct(p.ratio, 0)}</span>
                </div>
                <Progress ratio={p.ratio} tone={p.late ? 'neg' : 'accent'} label={`${g.name} progress`} />
                <p className="text-[13px] text-muted">
                  {p.reached ? (
                    <span className="font-medium text-pos">Goal reached</span>
                  ) : p.late ? (
                    <span className="font-medium text-neg">Past the deadline ({fmtDate(g.deadline!)}) · {money(p.remaining)} to go</span>
                  ) : p.perMonth !== null ? (
                    <>
                      {money(p.remaining)} to go · save about <span className="num font-medium text-ink">{money(p.perMonth)}</span> per month until {fmtDate(g.deadline!)}
                    </>
                  ) : (
                    <>{money(p.remaining)} to go</>
                  )}
                </p>
                <div className="flex gap-2">
                  <Button className="min-h-[44px] flex-1" onClick={() => setAdding(g)} disabled={p.reached}>
                    Add money
                  </Button>
                  <Button variant="secondary" className="min-h-[44px]" onClick={() => setEditing(g)}>
                    Edit
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {editing && <GoalModal goal={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {adding && <AddMoneyModal goal={adding} onClose={() => setAdding(null)} />}
    </div>
  )
}
