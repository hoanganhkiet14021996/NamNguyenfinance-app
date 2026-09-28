import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ArrowLeftRight, Landmark, Plus, Receipt, Search } from 'lucide-react'
import CashFlowChart from '../components/charts/CashFlowChart'
import NetWorthChart from '../components/charts/NetWorthChart'
import SpendingDonut from '../components/charts/SpendingDonut'
import FinancialHealth from '../components/FinancialHealth'
import InsightsPanel from '../components/InsightsPanel'
import { useModals } from '../components/modals/ModalHost'
import { TransactionCards, TransactionTable } from '../components/TransactionTable'
import { Button, Card, CardTitle, Delta, EmptyState } from '../components/ui'
import { useMoney } from '../hooks/useMoney'
import { balancesAtDates, monthEnd, monthSummary, shiftMonth, totalsFromBalances } from '../lib/calc'
import { greeting, pct } from '../lib/format'
import { useStore } from '../store/AppStore'

function Kpi({ label, value, children, className }: { label: string; value: string; children?: React.ReactNode; className?: string }) {
  return (
    <Card hover className={`p-4 ${className ?? ''}`}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="num mt-1.5 text-2xl font-semibold tracking-tight lg:text-[28px]">{value}</p>
      <div className="mt-1 min-h-4">{children}</div>
    </Card>
  )
}

export default function Dashboard() {
  const { data, totals, today } = useStore()
  const { openTransaction, openTransfer, openAccount, openSearch } = useModals()
  const money = useMoney()

  const month = today.slice(0, 7)
  const day = Number(today.slice(8))
  const prevMonth = shiftMonth(month, -1)

  const prevTotals = useMemo(() => {
    const [b] = balancesAtDates(data.accounts, data.transactions, [monthEnd(prevMonth)])
    return totalsFromBalances(data.accounts, b)
  }, [data.accounts, data.transactions, prevMonth])

  const now = monthSummary(data.transactions, month)
  const before = monthSummary(data.transactions, prevMonth, day)
  const rateDelta = now.savingsRate !== null && before.savingsRate !== null ? (now.savingsRate - before.savingsRate) * 100 : null

  const recent = useMemo(
    () => [...data.transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 8),
    [data.transactions],
  )

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-[30px]">
            {greeting()}, {data.settings.name}
          </h1>
          <p className="mt-1 text-sm text-muted">{format(parseISO(today), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={openSearch} className="max-md:hidden" aria-label="Search (Ctrl+K)">
            <Search size={15} />
            <span className="text-muted">Search</span>
            <kbd className="rounded border border-line px-1.5 text-[11px] text-muted">Ctrl K</kbd>
          </Button>
          <Button onClick={() => openTransaction()} className="max-md:hidden">
            <Plus size={16} /> Add transaction
          </Button>
        </div>
      </header>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        <Button variant="secondary" className="shrink-0" onClick={() => openTransaction()}><Receipt size={15} /> Add Transaction</Button>
        <Button variant="secondary" className="shrink-0" onClick={openTransfer}><ArrowLeftRight size={15} /> Transfer Money</Button>
        <Button variant="secondary" className="shrink-0" onClick={() => openAccount()}><Landmark size={15} /> Add Account</Button>
      </div>

      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Net Worth" value={money(totals.netWorth, { mode: 'compact' })} className="col-span-2 lg:col-span-1">
          <Delta value={totals.netWorth - prevTotals.netWorth} format={(n) => money(n, { mode: 'compact' })} suffix=" vs last month" />
        </Kpi>
        <Kpi label="Cash Available" value={money(totals.cash, { mode: 'compact' })}>
          <Delta value={totals.cash - prevTotals.cash} format={(n) => money(n, { mode: 'compact' })} suffix=" vs last month" />
        </Kpi>
        <Kpi label="Monthly Income" value={money(now.income, { mode: 'compact' })}>
          <span className="text-xs text-muted">vs {money(before.income, { mode: 'compact' })} last month</span>
        </Kpi>
        <Kpi label="Monthly Spending" value={money(now.expenses, { mode: 'compact' })}>
          <span className="text-xs text-muted">vs {money(before.expenses, { mode: 'compact' })} last month</span>
        </Kpi>
        <Kpi label="Savings Rate" value={now.savingsRate === null ? '–' : pct(now.savingsRate)}>
          {rateDelta !== null && <Delta value={rateDelta} format={(n) => `${n.toFixed(1)} pts`} suffix=" vs last month" />}
        </Kpi>
      </section>

      <NetWorthChart />

      <div className="grid gap-6 lg:grid-cols-2">
        <CashFlowChart />
        <SpendingDonut />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <FinancialHealth />
        <InsightsPanel />
      </div>

      <Card className="px-4 pt-5 md:px-5">
        <CardTitle
          action={
            <Link to="/transactions" className="text-sm text-accent hover:underline">
              View all
            </Link>
          }
        >
          Recent transactions
        </CardTitle>
        {recent.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            text="Add your first transaction to start tracking your cash flow."
            action={<Button onClick={() => openTransaction()}><Plus size={16} /> Add Transaction</Button>}
          />
        ) : (
          <>
            <TransactionTable rows={recent} short />
            <TransactionCards rows={recent} />
          </>
        )}
      </Card>
    </div>
  )
}
