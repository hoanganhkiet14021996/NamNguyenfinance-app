import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { debtRatio, emergencyFundMonths, monthlyBurn, monthlyLimit, monthSummary } from '../lib/calc'
import { pct } from '../lib/format'
import { useMoney } from '../hooks/useMoney'
import { useStore } from '../store/AppStore'
import { Card, CardTitle, Progress } from './ui'

interface Metric {
  label: string
  value: string
  target: string
  ratio: number
  ok: boolean | null
  okText: string
  badText: string
}

export default function FinancialHealth() {
  const money = useMoney()
  const { data, totals, today } = useStore()
  const month = today.slice(0, 7)

  const savingsRate = monthSummary(data.transactions, month).savingsRate
  const burn = monthlyBurn(data.transactions, month)
  const months = emergencyFundMonths(totals.cash, burn)
  const ratio = debtRatio(totals.liabilities, totals.netWorth)
  const totalBudget = monthlyLimit(data.plan, data.budgets, month)
  const budgetSpent = monthSummary(data.transactions, month).expenses
  const target = data.plan.savingsTargetRate

  const metrics: Metric[] = [
    {
      label: 'Savings Rate',
      value: savingsRate === null ? '–' : pct(savingsRate),
      target: `Target: ${pct(target, 0)} or more`,
      ratio: savingsRate === null || target <= 0 ? 0 : savingsRate / target,
      ok: savingsRate === null ? null : savingsRate >= target,
      okText: 'On track',
      badText: 'Below target',
    },
    {
      label: 'Emergency Fund',
      value: months === null ? '–' : `${months.toFixed(1)} months`,
      target: 'Target: 6 months',
      ratio: months === null ? 0 : months / 6,
      ok: months === null ? null : months >= 6,
      okText: 'On track',
      badText: 'Keep building',
    },
    {
      label: 'Debt / Net Worth',
      value: ratio === null ? 'n/a' : pct(ratio),
      target: 'Target: 30% or less',
      ratio: ratio === null ? 0 : ratio / 0.3,
      ok: ratio === null ? null : ratio <= 0.3,
      okText: 'Healthy',
      badText: 'High',
    },
    {
      label: 'Monthly Burn',
      value: money(burn, { mode: 'compact' }),
      target: totalBudget > 0 ? `Budget: ${money(totalBudget, { mode: 'compact' })}` : 'No budget set',
      ratio: totalBudget > 0 ? budgetSpent / totalBudget : 0,
      ok: totalBudget > 0 ? budgetSpent <= totalBudget : null,
      okText: 'Within budget',
      badText: 'Over budget',
    },
  ]

  return (
    <Card>
      <CardTitle>Financial Health</CardTitle>
      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
        {metrics.map((m) => (
          <div key={m.label}>
            <p className="text-xs text-muted">{m.label}</p>
            <p className="num mt-0.5 text-xl font-semibold">{m.value}</p>
            <div className="my-2">
              <Progress ratio={m.ratio} tone={m.ok === false ? 'warn' : 'accent'} label={`${m.label} progress`} />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">{m.target}</span>
              {m.ok !== null && (
                <span className={`flex items-center gap-1 font-medium ${m.ok ? 'text-pos' : 'text-warn'}`}>
                  {m.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                  {m.ok ? m.okText : m.badText}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
