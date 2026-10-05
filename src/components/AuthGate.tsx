import { createContext, useCallback, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { buildEmptyData } from '../data/demo'
import { displayName, PIN_LENGTH, signInWithPin, signUpWithPin, signOut as authSignOut } from '../lib/auth'
import { pullData } from '../lib/cloud'
import { loadData, clearLocalData } from '../lib/storage'
import { cloudConfigured, supabase } from '../lib/supabase'
import { StoreProvider } from '../store/AppStore'
import type { AppData } from '../types'
import { Button, Card, Field, Input } from './ui'

interface SessionInfo {
  name: string
  signOut: () => Promise<void>
}

const SessionContext = createContext<SessionInfo | null>(null)
/** Null when the app runs without a cloud account (e.g. Supabase env vars missing). */
export const useSession = () => useContext(SessionContext)

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}

function SignInForm() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      await (mode === 'in' ? signInWithPin(username, pin) : signUpWithPin(username, pin))
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Something went wrong.')
    }
    setBusy(false)
  }

  return (
    <Shell>
      <Card className="space-y-4 p-6">
        <div>
          <img src={`${import.meta.env.BASE_URL}logo-mark.png`} alt="" className="mb-3 h-14 w-14 rounded-2xl" />
          <h1 className="text-xl font-semibold tracking-tight">NAMONEY</h1>
          <p className="mt-1 text-sm text-muted">{mode === 'in' ? 'Sign in to see your data on any device.' : 'Create your account.'}</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Name" hint={mode === 'up' ? 'Same name works in all your apps.' : undefined}>
            <Input autoComplete="username" autoCapitalize="none" required autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
          </Field>
          <Field label={`PIN (${PIN_LENGTH} digits)`}>
            <Input
              type="password"
              inputMode="numeric"
              pattern={`\\d{${PIN_LENGTH}}`}
              maxLength={PIN_LENGTH}
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              required
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
          {message && <p role="alert" className="text-sm text-neg">{message}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'in' ? 'up' : 'in')
            setMessage('')
          }}
          className="text-sm text-muted hover:text-ink"
        >
          {mode === 'in' ? 'No account yet? Create one' : 'Already have an account? Sign in'}
        </button>
      </Card>
    </Shell>
  )
}

interface Loaded {
  initial: AppData
  baseline: AppData | null
}

/** Loads the signed-in user's data: the cloud copy if there is one, otherwise this device's real data (migration) or a fresh start. */
async function loadForUser(): Promise<Loaded> {
  const remote = await pullData()
  if (remote) return { initial: remote, baseline: remote }
  const local = loadData()
  return { initial: local && !local.isDemo ? local : buildEmptyData(), baseline: null }
}

function SignedIn({ session, children }: { session: Session; children: ReactNode }) {
  const userId = session.user.id
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setError('')
    loadForUser().then(
      (l) => !cancelled && setLoaded(l),
      (e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'Could not load your data.'),
    )
    return () => {
      cancelled = true
    }
  }, [userId, attempt])

  const signOut = useCallback(async () => {
    await authSignOut()
    clearLocalData()
  }, [])

  if (!loaded) {
    return (
      <Shell>
        {error ? (
          <Card className="space-y-3 p-6">
            <p className="font-medium">Could not load your data</p>
            <p className="text-sm text-muted">{error}</p>
            <div className="flex gap-2">
              <Button onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
              <Button variant="secondary" onClick={signOut}>Sign out</Button>
            </div>
          </Card>
        ) : (
          <p role="status" className="text-center text-sm text-muted">Loading your data…</p>
        )}
      </Shell>
    )
  }

  return (
    <SessionContext.Provider value={{ name: displayName(session.user), signOut }}>
      <StoreProvider key={userId} initialData={loaded.initial} baseline={loaded.baseline} userId={userId}>
        {children}
      </StoreProvider>
    </SessionContext.Provider>
  )
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    if (!cloudConfigured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  // No Supabase env vars (e.g. a fresh clone): run local-only, like before.
  if (!cloudConfigured) return <StoreProvider>{children}</StoreProvider>
  if (session === undefined) {
    return (
      <Shell>
        <p role="status" className="text-center text-sm text-muted">Loading…</p>
      </Shell>
    )
  }
  if (!session) return <SignInForm />
  return <SignedIn session={session}>{children}</SignedIn>
}
