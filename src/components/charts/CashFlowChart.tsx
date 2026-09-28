import { useMemo, useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { cashFlowSeries, type CashFlowPoint, type Granularity } from '../../lib/calc'
import { axisMoney } from '../../lib/format'
import { useMoney } from '../../hooks/useMoney'
import { useStore } from '../../store/AppStore'
import { Card, CardTitle, Segmented } from '../ui'

function Tip({ active, payload }: { active?: boolean; payload?: { payload: CashFlowPoint }[] }) {
  const money = useMoney()
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-xl border border-line bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium">{p.label}</p>
      <p className="num text-accent">Income: {money(p.income, { mode: 'compact' })}</p>
      <p className="num text-muted">Expenses: {money(p.expenses, { mode: 'compact' })}</p>
      <p className="num mt-0.5 font-semibold">Net: {money(p.net, { mode: 'compact', sign: true })}</p>
    </div>
  )
}

export default function CashFlowChart() {
  const { data, today } = useStore()
  const [granularity, setGranularity] = useState<Granularity>('monthly')
  const series = useMemo(() => cashFlowSeries(data.transactions, granularity, today), [data.transactions, granularity, today])

  return (
    <Card>
      <CardTitle
        action={
          <Segmented
            label="Cash flow period"
            value={granularity}
            onChange={setGranularity}
            options={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'quarterly', label: 'Quarterly' },
              { value: 'yearly', label: 'Yearly' },
            ]}
          />
        }
      >
        Income vs Expenses
      </CardTitle>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--muted)' }} />
            <YAxis width={48} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--muted)' }} tickFormatter={axisMoney} />
            <Tooltip content={<Tip />} cursor={{ fill: 'var(--soft)' }} />
            <Bar dataKey="income" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={18} animationDuration={300} />
            <Bar dataKey="expenses" fill="var(--muted)" fillOpacity={0.45} radius={[4, 4, 0, 0]} maxBarSize={18} animationDuration={300} />
            <Line type="monotone" dataKey="net" stroke="var(--ink)" strokeWidth={2} dot={{ r: 2.5 }} animationDuration={300} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-accent" />Income</li>
        <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-muted/50" />Expenses</li>
        <li className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-ink" />Net cash flow</li>
      </ul>
    </Card>
  )
}
