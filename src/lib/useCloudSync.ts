import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppData } from '../types'
import { pushChanges } from './cloud'

export type SyncStatus = 'idle' | 'saving' | 'error'

const DEBOUNCE_MS = 700
const RETRY_MS = 10_000

/**
 * Keeps the cloud copy equal to `data`. `baseline` is what the cloud already holds
 * (null = nothing yet, so everything is uploaded). Without a userId this does nothing.
 */
export function useCloudSync(data: AppData, userId: string | undefined, baseline: AppData | null) {
  const synced = useRef<AppData | null>(baseline)
  const latest = useRef(data)
  const running = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const [status, setStatus] = useState<SyncStatus>('idle')
  latest.current = data

  const flush = useCallback(async () => {
    if (!userId || running.current) return
    running.current = true
    try {
      while (synced.current !== latest.current) {
        const target = latest.current
        setStatus('saving')
        await pushChanges(userId, synced.current, target)
        synced.current = target
      }
      setStatus('idle')
    } catch {
      setStatus('error')
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => void flush(), RETRY_MS)
    } finally {
      running.current = false
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void flush(), DEBOUNCE_MS)
    return () => window.clearTimeout(timer.current)
  }, [data, userId, flush])

  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && void flush()
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [flush])

  return { status, retry: flush }
}
