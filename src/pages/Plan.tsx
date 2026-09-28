import { useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import CategoryIcon from '../components/CategoryIcon'
import { Card, CardTitle, Field, Input, PageHeader, Progress } from '../components/ui'
import { useMoney } from '../hooks/useMoney'
import { budgetsForMonth, monthlyLimit, monthSummary } from '../lib/calc'
import { num, pct } from '../lib/format'
import { useStore } from '../store/AppStore'

function MoneyField({ value, onCommit, label, placeholder = '0' }: { value: number; onCommit: (n: number) => void; label: string; placeholder?: string }) {
  const [text, setText] = useState<string | null>(null)
  return (
    <div className="flex items-center gap-2">
      <Input
        aria-label={label}
        inputMode="numeric"
        placeholder={placeholder}
        className="num text-right"
        value={text ?? (value ? num(value) : '')}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 13)
          setText(digits ? num(Number(digits)) : '')
        }}
        onBlur={() => {
          if (text !== null) onCommit(Number(text.replace(/\D/g, '')) || 0)
          setText(null)
        }}
      />
      <span className="text-muted">₫</span>
    </div>
  )
}

export default function Plan() {
  const { data, today, updatePlan, setBudget } = useStore()
  const money = useMoney()
  const { plan } = data
  const month = today.slice(0, 7)

  const budgets = new Map(budgetsForMonth(data.budgets, month).map((b) => [b.categoryId, b.amount]))
  const summary = monthSummary(data.transactions, month)
  const spentByCat = new Map<string, number>()
  for (const t of data.transactions) {
    if (t.type === 'expense' && t.categoryId && t.date.startsWith(month)) spentByCat.set(t.categoryId, (spentByCat.get(t.categoryId) ?? 0) + t.amount)
  }

  const monthlyIncome = plan.monthlySalary + plan.annualBonus / 12
  const limit = monthlyLimit(plan, data.budgets, month)
  const plannedSavings = monthlyIncome - limit
  const plannedRate = monthlyIncome > 0 ? plannedSavings / monthlyIncome : null
  const categoryTotal = [...budgets.values()].reduce((s, n) => s + n, 0)
  const onTrack = plannedRate !== null && limit > 0 && plannedRate >= plan.savingsTargetRate

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Plan" subtitle="Your salary, bonus and spending limits. Changes save automatically." />

      <Card className="mb-4">
        <CardTitle>Monthly plan</CardTitle>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-muted">Expected income</dt>
            <dd className="num text-lg font-semibold">{money(monthlyIncome, { mode: 'compact' })}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Spending limit</dt>
            <dd className="num text-lg font-semibold">{limit > 0 ? money(limit, { mode: 'compact' }) : 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Planned savings</dt>
            <dd className="num text-lg font-semibold">{limit > 0 ? money(plannedSavings, { mode: 'compact' }) : '–'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Planned savings rate</dt>
            <dd className="num text-lg font-semibold">{plannedRate !== null && limit > 0 ? pct(plannedRate, 0) : '–'}</dd>
          </div>
        </dl>
        {limit > 0 && plannedRate !== null && (
          <p className={`mt-4 flex items-center gap-1.5 text-sm font-medium ${onTrack ? 'text-pos' : 'text-warn'}`}>
            {onTrack ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            {onTrack ? `Meets your ${pct(plan.savingsTargetRate, 0)} savings target` : `Below your ${pct(plan.savingsTargetRate, 0)} savings target`}
          </p>
        )}
        <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
          This month so far: income {money(summary.income, { mode: 'compact' })}, spending {money(summary.expenses, { mode: 'compact' })}.
        </p>
      </Card>

      <Card className="mb-4 space-y-4">
        <CardTitle>Income</CardTitle>
        <Field label="Monthly salary (take-home)">
          <MoneyField label="Monthly salary" value={plan.monthlySalary} onCommit={(n) => updatePlan({ monthlySalary: n })} />
        </Field>
        <Field label="Bonus per year (total)" hint={plan.annualBonus > 0 ? `About ${money(plan.annualBonus / 12, { mode: 'compact' })} per month` : 'Tet bonus, 13th-month salary, etc.'}>
          <MoneyField label="Annual bonus" value={plan.annualBonus} onCommit={(n) => updatePlan({ annualBonus: n })} />
        </Field>
      </Card>

      <Card className="mb-4 space-y-4">
        <CardTitle>Spending budget</CardTitle>
        <Field
          label="Total monthly budget"
          hint={categoryTotal > 0 ? `Leave empty to use the sum of category budgets (${money(categoryTotal, { mode: 'compact' })}).` : 'Your overall limit for the month.'}
        >
          <MoneyField label="Total monthly budget" value={plan.monthlyBudget} onCommit={(n) => updatePlan({ monthlyBudget: n })} />
        </Field>
        <Field label="Savings target (% of income)">
          <div className="flex items-center gap-2">
            <Input
              aria-label="Savings target percent"
              type="number"
              min={0}
              max={100}
              inputMode="numeric"
              className="num text-right"
              defaultValue={Math.round(plan.savingsTargetRate * 100)}
              key={plan.savingsTargetRate}
              onBlur={(e) => updatePlan({ savingsTargetRate: Math.min(100, Math.max(0, Number(e.target.value) || 0)) / 100 })}
            />
            <span className="text-muted">%</span>
          </div>
        </Field>
      </Card>

      <Card>
        <CardTitle>Category budgets</CardTitle>
        <p className="-mt-2 mb-4 text-xs text-muted">Optional monthly limits per category. Progress shows this month.</p>
        <ul className="space-y-5">
          {data.categories
            .filter((c) => c.kind === 'expense')
            .map((c) => {
              const amount = budgets.get(c.id) ?? 0
              const used = spentByCat.get(c.id) ?? 0
              const ratio = amount > 0 ? used / amount : 0
              return (
                <li key={c.id}>
                  <div className="flex items-center gap-3">
                    <CategoryIcon category={c} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                    <div className="w-40">
                      <MoneyField label={`${c.name} budget`} value={amount} onCommit={(n) => setBudget({ month: 'all', categoryId: c.id, amount: n })} placeholder="No limit" />
                    </div>
                  </div>
                  {amount > 0 && (
                    <div className="mt-2 pl-12">
                      <Progress ratio={ratio} tone={ratio > 1 ? 'neg' : ratio >= 0.8 ? 'warn' : 'accent'} label={`${c.name} budget used`} />
                      <p className={`num mt-1 text-xs ${ratio > 1 ? 'font-medium text-neg' : 'text-muted'}`}>
                        {money(used, { mode: 'compact' })} of {money(amount, { mode: 'compact' })} · {ratio > 1 ? `over by ${money(used - amount, { mode: 'compact' })}` : `${Math.round(ratio * 100)}% used`}
                      </p>
                    </div>
                  )}
                </li>
              )
            })}
        </ul>
      </Card>
    </div>
  )
}
