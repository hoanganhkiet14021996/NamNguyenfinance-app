import { useState } from 'react'
import { isLiability } from '../../lib/calc'
import { useStore } from '../../store/AppStore'
import type { Account, AccountType } from '../../types'
import { AmountInput, Button, Field, Input, Modal, Select } from '../ui'

export const accountTypeLabels: Record<AccountType, string> = {
  cash: 'Cash',
  bank: 'Bank',
  credit_card: 'Credit Card',
  investment: 'Investment',
  loan: 'Loan',
}

const liabilityTypes: AccountType[] = ['credit_card', 'loan']

export function AccountModal({ account, onClose, onCreated }: { account?: Account; onClose: () => void; onCreated?: (id: string) => void }) {
  const { addAccount, updateAccount } = useStore()
  const [name, setName] = useState(account?.name ?? '')
  const [institution, setInstitution] = useState(account?.institution ?? '')
  const [type, setType] = useState<AccountType>(account?.type ?? 'bank')
  const [balance, setBalance] = useState(0)
  const liability = liabilityTypes.includes(type)

  function save() {
    if (!name.trim()) return
    if (account) {
      updateAccount(account.id, { name: name.trim(), institution: institution.trim(), type })
    } else {
      const id = addAccount({
        name: name.trim(),
        institution: institution.trim() || name.trim(),
        type,
        openingBalance: liability ? -balance : balance,
      })
      onCreated?.(id)
    }
    onClose()
  }

  return (
    <Modal title={account ? 'Edit account' : 'Add account'} onClose={onClose} dismissOnBackdrop={false}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <Field label="Account name">
          <Input data-autofocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Techcombank" />
        </Field>
        <Field label="Institution">
          <Input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Optional" />
        </Field>
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {Object.entries(accountTypeLabels).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </Field>
        {!account && (
          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted">{liability ? 'Amount owed today' : 'Current balance'}</span>
            <AmountInput value={balance} onChange={setBalance} />
          </div>
        )}
        <Button type="submit" className="w-full" disabled={!name.trim()}>
          {account ? 'Save changes' : 'Add account'}
        </Button>
      </form>
    </Modal>
  )
}

export function AdjustBalanceModal({ account, onClose }: { account: Account; onClose: () => void }) {
  const { balances, adjustBalance } = useStore()
  const liability = isLiability(account)
  const current = balances.get(account.id) ?? 0
  const [value, setValue] = useState(Math.abs(current))

  return (
    <Modal title="Adjust balance" onClose={onClose} dismissOnBackdrop={false}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          adjustBalance(account.id, liability ? -value : value)
          onClose()
        }}
      >
        <p className="text-sm text-muted">
          Set the correct {liability ? 'amount owed' : 'balance'} for {account.name}. The difference is applied to the account's starting balance, so past
          transactions are unchanged.
        </p>
        <AmountInput value={value} onChange={setValue} autoFocus />
        <Button type="submit" className="w-full">Update balance</Button>
      </form>
    </Modal>
  )
}
