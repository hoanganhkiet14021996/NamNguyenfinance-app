import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { monthEnd, spendingByCategory } from '../../lib/calc'
import { monthTitle, pct } from '../../lib/format'
import { useMoney } from '../../hooks/useMoney'
import { useStore } from '../../store/AppStore'
import { Card, CardTitle, EmptyState } from '../ui'

export default function SpendingDonut() {
  const { data, today } = useStore()
  const money = useMoney()
  const navigate = useNavigate()
  const month = today.slice(0, 7)

  const rows = useMemo(() => {
    const cats = new Map(data.categories.map((c) => [c.id, c]))
    return spendingByCategory(data.transactions, `${month}-01`, monthEnd(month)).map((r) => ({
      ...r,
      name: cats.get(r.categoryId)?.name ?? 'Uncategorized',
      color: cats.get(r.categoryId)?.color ?? '#78716c',
    }))
  }, [data.categories, data.transactions, month])
  const total = rows.reduce((s, r) => s + r.amount, 0)
  const open = (id: string) => navigate(`/transactions?category=${id}&range=month`)

  return (
    <Card>
      <CardTitle action={<span className="text-xs text-muted">{monthTitle(month)}</span>}>Where did my money go?</CardTitle>
      {rows.length === 0 ? (
        <EmptyState title="No spending yet" text="Expenses you add this month will be broken down by category here." />
      ) : (
        <div className="grid items-center gap-4 sm:grid-cols-[180px_1fr]">
          <div className="relative mx-auto h-44 w-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={rows} dataKey="amount" nameKey="name" innerRadius={56} outerRadius={82} paddingAngle={2} stroke="none" isAnimationActive={false} onClick={(d) => open((d as unknown as { categoryId: string }).categoryId)} animationDuration={400}>
                  {rows.map((r) => (
                    <Cell key={r.categoryId} fill={r.color} className="cursor-pointer outline-none" />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => money(Number(v))} contentStyle={{ borderRadius: 12, border: '1px solid var(--line)', background: 'var(--card)', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs text-muted">Spent</span>
              <span className="num text-sm font-semibold">{money(total, { mode: 'compact' })}</span>
            </div>
          </div>
          <ul className="space-y-1">
            {rows.map((r) => (
              <li key={r.categoryId}>
                <button onClick={() => open(r.categoryId)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-soft">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{r.name}</span>
                  <span className="num text-muted">{money(r.amount, { mode: 'compact' })}</span>
                  <span className="num w-12 text-right text-xs text-muted">{pct(r.amount / total)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
