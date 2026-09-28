import type { Account, Category, Transaction } from '../types'

export function downloadFile(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const cell = (v: string | number | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`

export function exportTransactionsCsv(rows: Transaction[], categories: Category[], accounts: Account[]) {
  const cats = new Map(categories.map((c) => [c.id, c.name]))
  const accs = new Map(accounts.map((a) => [a.id, a.name]))
  const lines = rows.map((t) =>
    [
      t.date,
      t.description,
      t.amount,
      t.type,
      t.categoryId ? cats.get(t.categoryId) : '',
      t.type === 'transfer' ? `${accs.get(t.accountId)} -> ${accs.get(t.toAccountId ?? '')}` : accs.get(t.accountId),
      t.notes,
    ]
      .map(cell)
      .join(','),
  )
  const csv = '﻿' + ['Date,Description,Amount,Type,Category,Account,Notes', ...lines].join('\n')
  downloadFile(`transactions-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8')
}
