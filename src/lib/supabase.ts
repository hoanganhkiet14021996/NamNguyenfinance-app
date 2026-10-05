import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const cloudConfigured = Boolean(url && key)

/** Password sign-in only, so no tokens are ever put in the URL (the app uses HashRouter). */
export const supabase = createClient(url || 'http://localhost', key || 'missing', {
  auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true, autoRefreshToken: true },
})
