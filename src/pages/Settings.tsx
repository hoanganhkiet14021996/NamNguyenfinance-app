import { useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardTitle, Field, Input, PageHeader, Segmented, Button, Select } from '../components/ui'
import { exportJson, parseBackup } from '../lib/backup'
import { exportTransactionsCsv } from '../lib/csv'
import { useStore } from '../store/AppStore'
import type { Settings as SettingsType } from '../types'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="mb-4">
      <CardTitle>{title}</CardTitle>
      <div className="space-y-4">{children}</div>
    </Card>
  )
}

export default function Settings() {
  const { data, updateSettings, resetDemo, clearAll, importData } = useStore()
  const { settings } = data
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')

  async function onImport(file?: File) {
    if (!file) return
    try {
      const next = await parseBackup(file)
      if (confirm('Importing replaces all current data. Continue?')) {
        importData(next)
        setMessage('Data imported.')
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not read that file.')
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" />

      <Section title="Profile">
        <Field label="Your name">
          <Input value={settings.name} onChange={(e) => updateSettings({ name: e.target.value })} />
        </Field>
      </Section>

      <Section title="Currency & formats">
        <Field label="Currency">
          <Input value="VND (₫)" disabled />
        </Field>
        <Field label="Number display">
          <div>
            <Segmented<SettingsType['numberFormat']>
              label="Number display"
              value={settings.numberFormat}
              onChange={(numberFormat) => updateSettings({ numberFormat })}
              options={[
                { value: 'full', label: 'Full (12,500,000 ₫)' },
                { value: 'compact', label: 'Compact (12.5M ₫)' },
              ]}
            />
          </div>
        </Field>
        <Field label="Date format">
          <Select value={settings.dateFormat} onChange={(e) => updateSettings({ dateFormat: e.target.value as SettingsType['dateFormat'] })}>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </Select>
        </Field>
      </Section>

      <Section title="Appearance">
        <Field label="Theme">
          <div>
            <Segmented<SettingsType['theme']>
              label="Theme"
              value={settings.theme}
              onChange={(theme) => updateSettings({ theme })}
              options={[
                { value: 'system', label: 'System' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </div>
        </Field>
        <Field label="Density">
          <div>
            <Segmented<SettingsType['density']>
              label="Density"
              value={settings.density}
              onChange={(density) => updateSettings({ density })}
              options={[
                { value: 'comfortable', label: 'Comfortable' },
                { value: 'compact', label: 'Compact' },
              ]}
            />
          </div>
        </Field>
      </Section>

      <Section title="Categories & accounts">
        <p className="text-sm text-muted">
          {data.categories.length} categories.{' '}
          <Link to="/accounts" className="text-accent hover:underline">Manage accounts</Link> ({data.accounts.filter((a) => !a.archived).length} active).
        </p>
      </Section>

      <Section title="Data">
        <p className="text-sm text-muted">Everything is stored on this device only. Export a backup regularly.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => exportJson(data)}>Export data (JSON)</Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>Import data</Button>
          <Button variant="secondary" onClick={() => exportTransactionsCsv(data.transactions, data.categories, data.accounts)}>Export transactions (CSV)</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onImport(e.target.files?.[0])} />
        </div>
        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <Button variant="secondary" onClick={() => confirm('Replace all data with the demo set?') && resetDemo()}>Reset demo data</Button>
          <Button
            variant="danger"
            onClick={() => {
              if (confirm('Clear ALL data (accounts, transactions, budgets)? This cannot be undone.') && confirm('Are you sure? Export a backup first if unsure.')) clearAll()
            }}
          >
            Clear all data
          </Button>
        </div>
        {message && <p role="status" className="text-sm text-muted">{message}</p>}
      </Section>
    </div>
  )
}
