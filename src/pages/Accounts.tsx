import { Link } from 'react-router-dom'
import { Banknote, CreditCard, Landmark, LineChart, Plus, Wallet, type LucideIcon } from 'lucide-react'
import { accountTypeLabels } from '../components/modals/AccountModals'
import { useModals } from '../components/modals/ModalHost'
import { Button, Card, EmptyState, PageHeader } from '../components/ui'
import { useDate, useMoney } from '../hooks/useMoney'
import { isLiability } from '../lib/calc'
import { useStore } from '../store/AppStore'
import type { Account, AccountType } from '../types'

export const accountIcons: Record<AccountType, LucideIcon> = {
  cash: Banknote,
  bank: Landmark,
  credit_card: CreditCard,
  investment: LineChart,
  loan: Wallet,
}

const order: AccountType[] = ['cash', 'bank', 'credit_card', 'investment', 'loan']

export function AccountCard({ account }: { account: Account }) {
  const { balances } = useStore()
  const money = useMoney()
  const fmtDate = useDate()
  const Icon = accountIcons[account.type]
  const balance = balances.get(account.id) ?? 0
  return (
    <Link to={`/accounts/${account.id}`} className="card card-hover block p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-soft text-muted" aria-hidden="true">
          <Icon size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{account.name}</p>
          <p className="truncate text-xs text-muted">
            {account.institution} · {accountTypeLabels[account.type]}
            {isLiability(account) && ' (liability)'}
          </p>
        </div>
      </div>
      <p className="num mt-4 text-2xl font-semibold tracking-tight">{money(balance)}</p>
      <p className="mt-1 text-xs text-muted">Updated {fmtDate(account.updatedAt)}</p>
    </Link>
  )
}

export default function Accounts() {
  const { data, totals, archiveAccount } = useStore()
  const { openAccount } = useModals()
  const money = useMoney()
  const active = data.accounts.filter((a) => !a.archived)
  const archived = data.accounts.filter((a) => a.archived)

  return (
    <div>
      <PageHeader
        title="Accounts"
        subtitle="Where your money is"
        actions={<Button onClick={() => openAccount()}><Plus size={16} /> Add Account</Button>}
      />

      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-medium text-muted">Total Assets</p>
          <p className="num mt-1.5 text-2xl font-semibold">{money(totals.assets, { mode: 'compact' })}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted">Total Liabilities</p>
          <p className="num mt-1.5 text-2xl font-semibold">{money(totals.liabilities, { mode: 'compact' })}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted">Net Worth</p>
          <p className="num mt-1.5 text-2xl font-semibold text-accent">{money(totals.netWorth, { mode: 'compact' })}</p>
        </Card>
      </div>

      {active.length === 0 ? (
        <Card>
          <EmptyState
            title="No accounts yet"
            text="Add your bank accounts, cards and investments to see where your money is."
            action={<Button onClick={() => openAccount()}><Plus size={16} /> Add Account</Button>}
          />
        </Card>
      ) : (
        order.map((type) => {
          const list = active.filter((a) => a.type === type)
          if (!list.length) return null
          return (
            <section key={type} className="mb-8">
              <h2 className="mb-3 text-lg font-semibold">{accountTypeLabels[type]}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((a) => (
                  <AccountCard key={a.id} account={a} />
                ))}
              </div>
            </section>
          )
        })
      )}

      {archived.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-muted">Archived</h2>
          <div className="space-y-2">
            {archived.map((a) => (
              <Card key={a.id} className="flex items-center justify-between p-3">
                <span className="text-sm">{a.name}</span>
                <Button variant="ghost" onClick={() => archiveAccount(a.id, false)}>Restore</Button>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
