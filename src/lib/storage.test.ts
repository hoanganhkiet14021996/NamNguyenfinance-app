import { beforeEach, describe, expect, it } from 'vitest'
import { buildDemoData } from '../data/demo'
import { loadData } from './storage'

describe('loadData migration', () => {
  const store = new Map<string, string>()
  beforeEach(() => {
    store.clear()
    ;(globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    } as Storage
  })

  it('upgrades version 1 data', () => {
    const old = { ...buildDemoData('2026-09-20'), version: 1 } as Record<string, unknown>
    delete old.plan
    store.set('personal-cfo.v1', JSON.stringify(old))
    const data = loadData()
    expect(data?.version).toBe(2)
    expect(data?.plan.monthlyBudget).toBeGreaterThan(0)
    expect(data?.budgets.every((b) => b.month === 'all')).toBe(true)
  })
})
