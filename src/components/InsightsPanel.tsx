import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { buildInsights } from '../lib/insights'
import { useStore } from '../store/AppStore'
import { Card, CardTitle, cx } from './ui'

const tones = {
  positive: { icon: CheckCircle2, cls: 'text-pos' },
  warning: { icon: AlertTriangle, cls: 'text-warn' },
  info: { icon: Info, cls: 'text-info' },
}

export default function InsightsPanel() {
  const { data, today, dismissInsight } = useStore()
  const insights = useMemo(
    () => buildInsights({ accounts: data.accounts, categories: data.categories, transactions: data.transactions, budgets: data.budgets, today }),
    [data.accounts, data.categories, data.transactions, data.budgets, today],
  )
  const visible = insights.filter((i) => !data.dismissedInsights.includes(i.id)).slice(0, 5)

  return (
    <Card>
      <CardTitle>Insights</CardTitle>
      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Nothing needs your attention right now.</p>
      ) : (
        <ul className="space-y-3">
          {visible.map((i) => {
            const t = tones[i.tone]
            return (
              <li key={i.id} className="flex gap-3">
                <t.icon size={16} className={cx('mt-0.5 shrink-0', t.cls)} aria-label={i.tone} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{i.text}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {i.source}
                    {i.link && (
                      <>
                        {' · '}
                        <Link to={i.link} className="text-accent hover:underline">View transactions</Link>
                      </>
                    )}
                  </p>
                </div>
                <button onClick={() => dismissInsight(i.id)} aria-label="Dismiss insight" className="h-fit rounded-md p-1 text-muted hover:bg-soft">
                  <X size={14} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
