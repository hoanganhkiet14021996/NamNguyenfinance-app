import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Archive, Pencil, SlidersHorizontal } from 'lucide-react'
import { accountTypeLabels } from '../components/modals/AccountModals'
import { useModals } from '../components/modals/ModalHost'
import { TransactionCards, TransactionTable } from '../components/TransactionTable'
import { Button, Card, CardTitle, ConfirmButton, EmptyState, PageHeader } from '../components/ui'
import { useMoney } from '../hooks/useMoney'
import { balancesAtDates, monthEnd, monthRange, txEffect } from '../lib/calc'
import { axisMoney } from '../lib/format'
import { useStore } from '../store/AppStore'

export default function AccountDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data, balances, today, archiveAccount } = useStore()
  const { openAccount, openAdjust } = useModals()
  const money = useMoney()

  const account = data.accounts.find((a) => a.id === id)
  const txs = useMemo(() => data.transactions.filter((t) => t.accountId === id || t.toAccountId === id), [data.transactions, id])

  const history = useMemo(() => {
    if (!account) return []
    const month = today.slice(0, 7)
    const first = txs.reduce((min, t) => (t.date < min ? t.date : min), today).slice(0, 7)
    let count = 1
    while (monthRange(month, count)[0] > first && count < 24) count++
    const months = monthRange(month, Math.max(count, 2))
    const dates = months.map((m) => (m === month ? today : monthEnd(m)))
    return balancesAtDates([account], data.transactions, dates).map((b, i) => ({
      date: dates[i],
      label: format(parseISO(dates[i]), "MMM ''yy"),
      balance: b.get(id) ?? 0,
    }))
  }, [account, data.transactions, txs, today, id])

  if (!account) {
    return (
      <Card>
        <EmptyState
          title="Account not found"
          text="It may have been removed."
          action={<Button onClick={() => navigate('/accounts')}>Back to accounts</Button>}
        />
      </Card>
    )
  }

  const month = today.slice(0, 7)
  let inflow = 0
  let outflow = 0
  for (const t of txs) {
    if (!t.date.startsWith(month)) continue
    const e = txEffect(t, id)
    if (e > 0) inflow += e
    else outflow -= e
  }
  const average = history.reduce((s, h) => s + h.balance, 0) / Math.max(history.length, 1)
  const recent = [...txs].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 15)

  return (
    <div>
      <Link to="/accounts" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Accounts
      </Link>
      <PageHeader
        title={account.name}
        subtitle={`${account.institution} · ${accountTypeLabels[account.type]}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => openAccount(account)}><Pencil size={15} /> Edit</Button>
            <Button variant="secondary" onClick={() => openAdjust(account)}><SlidersHorizontal size={15} /> Adjust balance</Button>
            <ConfirmButton
              variant="secondary"
              title="Hides the account and excludes it from totals. Its transactions are kept."
              confirmLabel={<><Archive size={15} /> Tap again to archive</>}
              onConfirm={() => {
                archiveAccount(account.id, true)
                navigate('/accounts')
              }}
            >
              <Archive size={15} /> Archive
            </ConfirmButton>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="col-span-2 p-4 lg:col-span-1">
          <p className="text-xs font-medium text-muted">Current balance</p>
          <p className="num mt-1.5 text-2xl font-semibold">{money(balances.get(id) ?? 0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted">Inflow this month</p>
          <p className="num mt-1.5 text-xl font-semibold text-pos">+{money(inflow, { mode: 'compact' })}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted">Outflow this month</p>
          <p className="num mt-1.5 text-xl font-semibold">-{money(outflow, { mode: 'compact' })}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted">Average balance</p>
          <p className="num mt-1.5 text-xl font-semibold">{money(average, { mode: 'compact' })}</p>
        </Card>
      </div>

      <Card className="mb-6">
        <CardTitle>Balance history</CardTitle>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="bal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--muted)' }} minTickGap={16} />
              <YAxis width={48} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--muted)' }} tickFormatter={axisMoney} />
              <Tooltip
                formatter={(v) => money(Number(v))}
                labelFormatter={(l) => String(l)}
                contentStyle={{ borderRadius: 12, border: '1px solid var(--line)', background: 'var(--card)', fontSize: 12 }}
              />
              <Area type="monotone" dataKey="balance" name="Balance" stroke="var(--accent)" strokeWidth={2.5} fill="url(#bal)" animationDuration={300} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="px-4 pt-5 md:px-5">
        <CardTitle
          action={
            <Link to={`/transactions?account=${id}&range=all`} className="text-sm text-accent hover:underline">
              View all
            </Link>
          }
        >
          Transactions
        </CardTitle>
        {recent.length === 0 ? (
          <EmptyState title="No transactions for this account" text="Transactions you add to this account will show up here." />
        ) : (
          <>
            <TransactionTable rows={recent} />
            <TransactionCards rows={recent} />
          </>
        )}
      </Card>
    </div>
  )
}
