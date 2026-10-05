# NAMONEY, formerly "Personal CFO" (single-user personal finance web app)
Renamed 2026-10-05. The localStorage key `personal-cfo.v1` and Supabase tables `fin_*` keep their old names on purpose (renaming would orphan saved data). The GitHub repo is still `NamNguyenfinance-app` (renaming it would change the live URL and break the Supabase Site URL).

Spec: `projectvision.txt` (source of truth). Build phase by phase; do not start a phase until the previous one is verified.
Talk to the user in Vietnamese; the app UI is English per the spec. The user is not a developer: explain steps simply, give copy-paste commands, say plainly what is and is not pushed.

## Live site and repo
- Live: https://hoanganhkiet14021996.github.io/NamNguyenfinance-app/ (GitHub Pages, deployed by `.github/workflows/deploy.yml` on every push to `main`; takes ~30-60 s).
- Repo: https://github.com/hoanganhkiet14021996/NamNguyenfinance-app (user's account `hoanganhkiet14021996`).
- `gh` CLI is NOT installed; plain `git` is enough. The user logged in to GitHub once through Git Credential Manager (browser pop-up), so `git push` works from this machine. Claude cannot enter credentials; if a push asks for login, the user runs `git push` in their own terminal.
- Only push when the user asks. Pushing `main` = changes the live site.

## Git state (as of 2026-10-06) , READ THIS FIRST
- 2026-10-06: branch `supabase` (cloud sync, NAMONEY rebrand, name+PIN sign-in, tap-twice confirms, smoke tests) was merged into `main` and pushed at the user's request, so the live site now has sign-in + cloud sync. Work on `main` from now on (the `supabase` branch is just history).
- No `window.confirm()` anywhere: the in-app browser pane and some installed web apps never show it (returns false). Use `ConfirmButton` / `useConfirmTap` from `src/components/ui.tsx`.
- Commit messages: end with the `Co-Authored-By:` line from the session's attribution instructions. In PowerShell, multi-line/quoted messages break `git commit -m`; write the message to a temp file and use `git commit -F <file>`.

## Supabase (cloud database + login) , working (user signed up, added and deleted transactions on 2026-10-06)
- Project URL `https://jaekhiuaybhsqtfsnuae.supabase.co`; the publishable key is in `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`). Both are public by design and committed on purpose; security comes from Row Level Security. NEVER put the `service_role`/secret key or the DB password in the repo or chat.
- One Supabase project is shared by several of the user's apps (the user manages Supabase from another workspace). `supabase/schema.sql` holds all of it, idempotent, to be pasted into Supabase > SQL Editor: CaliTrack tables copied unchanged (`profiles`, `food_logs`, `activity_logs`, `weight_logs`, `saved_meals`, `custom_foods`) + NAMONEY tables prefixed `fin_` (`fin_settings`, `fin_accounts`, `fin_categories`, `fin_transactions`, `fin_budgets`). Next apps get their own prefix. Every table: `user_id` + RLS ("own rows"). Supabase shows a scary "destructive / no RLS" warning for this file; the right choice is "Run and enable RLS".
- Schema has been run (2026-10-05): `fin_*` tables exist; anon gets `42501 permission denied` on them, which is intended (`revoke all ... from anon`).
- Code: `src/lib/supabase.ts` (client, password auth, no tokens in URL because of HashRouter; if env vars are empty the app runs local-only like before), `src/lib/cloud.ts` (`pullData`, `pushChanges` diff-based upsert/delete, paginates at 1000 rows), `src/lib/useCloudSync.ts` (debounced 0.7 s, retry every 10 s, flush on tab hide), `src/components/AuthGate.tsx` (sign-in/sign-up form, loads data, provides `useSession`), `StoreProvider` in `src/store/AppStore.tsx` takes `initialData/userId/baseline` and exposes `syncStatus`/`retrySync`, Settings > Account shows email, sync status, Sign out.
- Sign-in is "name + 6-digit PIN" (`src/lib/auth.ts`, copied from the user's other project for consistency): name -> fake email `<name>@namnguyen27.app` (domain chosen by the user), PIN = password, so one account works in every app on the shared project that uses the same domain. The user maintains this file; keep it in sync with the other project (only local diff: inline `normalize` because this app has no `search.ts`). Never change `EMAIL_DOMAIN` (locks out every account). Needs "Confirm email" OFF (it is, checked 2026-10-05); sign-up refuses otherwise.
- Login flow: remote data wins; if the account has no cloud data yet, real (non-demo) local data is uploaded once, otherwise it starts EMPTY (no demo data). Sign-out clears the local cache.
- Settings row `fin_settings` is written last on first upload, so a failed first upload is retried in full.

### Supabase checklist still open (user does these in the dashboard)
- Done: schema run, "Confirm email" off, user's account created, add/delete verified locally.
- Still open (2026-10-06): "Allow new users to sign up" is still ON (`/auth/v1/settings` -> `disable_signup:false`). Strangers could create accounts (they still cannot read others' data thanks to RLS). Turning it off also blocks new accounts in the user's other apps on this project.
- Not yet checked: Site URL in Authentication > URL Configuration; sign out/in and a second device (phone) on the live site.
- Not decided: whether CaliTrack (separate app/workspace) will point at this same Supabase project (needs its URL/key switched and any old data exported/imported), and what the user's "third" app is.

## Branding and theme
- Logo: `brand/logoNAMONEY-original.jfif` (user's original, 1024x1024, had a small AI watermark bottom-right which was removed in derived files). `brand/logo-mark-dark.png` and `brand/logo-mark-transparent.png` = N + yellow dot only, no wordmark (the user asked for these two for later use).
- App icons in `public/`: `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `favicon.png` (derived from the original, include the NAMONEY wordmark, full-bleed square), `logo-mark.png` (256 px logo-only, used on the login page). Sidebar still uses the wordmark icon; user may want logo-only there and for the phone icon later.
- Theme: deep teal. Dark: canvas `#071315`, card `#0d1d20`, accent `#2dd4bf`. Light: canvas `#f3f7f7`, accent `#0f766e`. Tokens live in `src/index.css`; `useTheme.ts` sets the browser theme-color. Default theme is `dark` (`src/data/settings.ts`, and `<html class="dark">` in `index.html` so the login page is dark). Users who already saved a theme keep it.
- Browser tab title and PWA name: `NAMONEY`.

## Status (features)
- User asked for a SIMPLE main screen: `/` (Home) = MTD expense + quick add (type amount, tap category = saved, with Undo). Keep it minimal. A free-text note field (placeholder "Ghi chú: cơm tấm, trà sữa…") is always visible under the amount; the note becomes the transaction description (falls back to the category name).
- Everything rich lives elsewhere: `/overview` (old dashboard: KPIs, charts, health, insights), `/plan` (salary, annual bonus, monthly budget, savings target, category budgets), `/transactions` (History), `/accounts`, `/settings`.
- Budgets are recurring (`month: 'all'`), optionally overridden per month; use `budgetsForMonth` / `monthlyLimit` in `calc.ts`.
- Not built yet: Goals, Investments, Analytics, Recurring, Loans, Subscriptions, CSV import (removed from nav for simplicity; re-add only if the user asks).
- Type-check, build and 9 tests pass on the `supabase` branch (last run 2026-10-05).
- The Add/Edit/Delete transaction flows were never fully clicked through by hand; verify when testing the cloud flow.

## Stack
React + TypeScript + Vite, Tailwind v4 (tokens in `src/index.css`), Recharts, lucide-react, Inter (fontsource), vite-plugin-pwa, HashRouter, `@supabase/supabase-js`. shadcn/ui is not installed; primitives live in `src/components/ui.tsx`.

## Architecture rules
- All money math lives in `src/lib/calc.ts` (and `insights.ts`); never duplicate it in components.
- Account balances are DERIVED: `openingBalance` + effect of transactions. Edit/delete/transfer correctness follows automatically. Liabilities (credit_card, loan) have negative balances.
- Transfers never count as income/expense (`monthSummary`, `cashFlowSeries` skip them).
- App state is one in-memory `AppData` object (`AppStore.tsx`); `src/lib/storage.ts` is the local cache (key `personal-cfo.v1`), `src/lib/cloud.ts` mirrors it to Supabase by diffing. When you add a field to `AppData`, update both the cloud mappers and `supabase/schema.sql`, and bump `DATA_VERSION` in `src/data/demo.ts`.
- Demo data is generated in `src/data/demo.ts` (seeded, relative to today).
- Do not use `crypto.randomUUID` (breaks on http LAN access); use `uid()` from `src/lib/ids.ts`.

## Commands
- `npm run dev` (add `-- --host` for phone testing on the LAN), `npm run build`, `npm test`.
- `npm run check` = all tests + type-check + build; the user runs it after edits. `src/app.test.ts` holds plain-language smoke tests of everyday tasks (sign-in helpers, add/edit/delete/transfer, budgets, local save, cloud diff with Supabase mocked). Add a case there when a new everyday feature lands.
- Deleting a transaction: tap it (Home recent list or History) > red "Delete" button in the edit sheet > confirm.
- The user runs ANOTHER project on port 5173. Always preview this one on its own port, e.g. `npx vite --port 5188 --strictPort --host 127.0.0.1`. Check `Get-NetTCPConnection -State Listen` first. Tell the user the exact URL.
- Opening `index.html` or `dist/index.html` by double-click shows a blank page (module scripts do not run from file://). Always use the dev server URL.
- To preview inside the app without logging in, create a temporary `.env.local` with empty `VITE_SUPABASE_URL=` and `VITE_SUPABASE_PUBLISHABLE_KEY=` (gitignored), restart vite, and DELETE it afterwards.
- Background dev servers started from Claude are killed after their max timeout (up to 2 h); that notification is harmless, just restart if needed.

## Deploy
Push to `main` -> `.github/workflows/deploy.yml` (Node 24, `npm ci`, `npm run build`, upload `dist`) -> GitHub Pages. `base: './'` and HashRouter mean no repo-name config is needed. `.env` is committed so the Actions build sees the Supabase URL and publishable key. Pages is already enabled (source: GitHub Actions).

## Environment
Windows 11, PowerShell 5.1 (no `&&`, use `;`). Do NOT rewrite source files with PowerShell `Set-Content`/`Out-File -Encoding utf8` (adds a BOM and changes line endings, corrupts UTF-8); use the Edit tool. The Edit tool requires reading the file first in the same session. Folder `D:\AI Work\Web app1` is outside the default Claude working directory, so use absolute paths.
