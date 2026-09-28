import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { format, parseISO } from 'date-fns'
import { netWorthDates, snapshotsAt, type NetWorthRange } from '../../lib/calc'
import { axisMoney } from '../../lib/format'
import { useMoney } from '../../hooks/useMoney'
import { useStore } from '../../store/AppStore'
import { Card, CardTitle, EmptyState, Segmented } from '../ui'

const ranges: NetWorthRange[] = ['1M', '3M', '6M', '1Y', 'All']

interface TipProps {
  active?: boolean
  payload?: { payload: { date: string; assets: number; liabilities: number; netWorth: number } }[]
}

function Tip({ active, payload }: TipProps) {
  const money = useMoney()
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-xl border border-line bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium">{format(parseISO(p.date), 'MMM d, yyyy')}</p>
      <p className="num text-muted">Assets: {money(p.assets, { mode: 'compact' })}</p>
      <p className="num text-muted">Liabilities: {money(p.liabilities, { mode: 'compact' })}</p>
      <p className="num mt-0.5 font-semibold text-accent">Net Worth: {money(p.netWorth, { mode: 'compact' })}</p>
    </div>
  )
}

export default function NetWorthChart() {
  const { data, today } = useStore()
  const [range, setRange] = useState<NetWorthRange>('6M')

  const series = useMemo(() => {
    const first = data.transactions.reduce((min, t) => (t.date < min ? t.date : min), today)
    const dates = netWorthDates(range, today, first)
    return snapshotsAt(data.accounts, data.transactions, dates).map((s) => ({
      ...s,
      label: format(parseISO(s.date), range === '1M' ? 'MMM d' : "MMM ''yy"),
    }))
  }, [range, data.accounts, data.transactions, today])

  return (
    <Card>
      <CardTitle
        action={
          <Segmented
            label="Net worth timeframe"
            value={range}
            onChange={setRange}
            options={ranges.map((r) => ({ value: r, label: r }))}
          />
        }
      >
        Net Worth
      </CardTitle>
      {data.accounts.length === 0 ? (
        <EmptyState title="No accounts yet" text="Add an account to see your net worth over time." />
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--muted)' }} minTickGap={16} />
              <YAxis width={48} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--muted)' }} tickFormatter={axisMoney} />
              <Tooltip content={<Tip />} cursor={{ stroke: 'var(--line)' }} />
              <Line type="monotone" dataKey="assets" stroke="var(--info)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive animationDuration={300} />
              <Line type="monotone" dataKey="liabilities" stroke="var(--warn)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive animationDuration={300} />
              <Line type="monotone" dataKey="netWorth" stroke="var(--accent)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} isAnimationActive animationDuration={300} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <li className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-accent" />Net worth</li>
        <li className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed" style={{ borderColor: 'var(--info)' }} />Assets</li>
        <li className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed" style={{ borderColor: 'var(--warn)' }} />Liabilities</li>
      </ul>
    </Card>
  )
}
