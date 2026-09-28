# Personal CFO (single-user personal finance web app)

Spec: `projectvision.txt` (source of truth). Build phase by phase; do not start a phase until the previous one is verified.
Talk to the user in Vietnamese; the app UI is English per the spec.

## Status
- User asked for a SIMPLE main screen: `/` (Home) = MTD expense + quick add (type amount, tap category = saved, with Undo). Keep it minimal.
- Everything rich lives elsewhere: `/overview` (old dashboard: KPIs, charts, health, insights), `/plan` (salary, annual bonus, monthly budget, savings target, category budgets), `/transactions` (History), `/accounts`, `/settings`.
- Budgets are recurring (`month: 'all'`), optionally overridden per month; use `budgetsForMonth` / `monthlyLimit` in `calc.ts`.
- Not built yet: Goals, Investments, Analytics, Recurring, Loans, Subscriptions, CSV import (removed from nav for simplicity; re-add only if the user asks).

## Where we stopped (2026-09-21)
- Working: Home, Overview, Plan, History, Accounts (+ detail), Settings, Ctrl+K search. Type-check, build and 9 tests pass. Data is demo data in localStorage (schema version 2; v1 auto-migrates).
- Only verified via headless-browser screenshots; the Add/Edit/Delete transaction flows were never clicked through by hand. Verify these first next session.
- User once saw a blank page on localhost; server checked fine from our side. Likely they opened index.html directly or the dev server was not running. If it recurs, ask what they see and check the browser console.
- Node.js LTS and Git were installed via winget; a new terminal/VS Code restart is needed to pick up PATH. Git repo is NOT initialized yet and there is no GitHub repo yet: user plans to do the GitHub part later (create empty repo, then `git init`, push to `main`, set Pages source to "GitHub Actions").
- Possible next steps (only if asked): Goals, Recurring transactions, CSV import, Investments, PNG app icon for iPhone home screen.

## Stack
React + TypeScript + Vite, Tailwind v4 (tokens in `src/index.css`), Recharts, lucide-react, Inter (fontsource), vite-plugin-pwa, HashRouter. shadcn/ui is not installed; primitives live in `src/components/ui.tsx`.

## Architecture rules
- All money math lives in `src/lib/calc.ts` (and `insights.ts`); never duplicate it in components.
- Account balances are DERIVED: `openingBalance` + effect of transactions. Edit/delete/transfer correctness follows automatically. Liabilities (credit_card, loan) have negative balances.
- Transfers never count as income/expense (`monthSummary`, `cashFlowSeries` skip them).
- Persistence goes through `src/lib/storage.ts` (localStorage, key `personal-cfo.v1`); swap it to add a backend. Bump `DATA_VERSION` in `src/data/demo.ts` when the schema changes.
- Demo data is generated in `src/data/demo.ts` (seeded, relative to today).
- Do not use `crypto.randomUUID` (breaks on http LAN access); use `uid()` from `src/lib/ids.ts`.

## Commands
- `npm run dev` (add `-- --host` for phone testing on the LAN), `npm run build`, `npm test`.

## Deploy
Push to `main` -> `.github/workflows/deploy.yml` -> GitHub Pages. `base: './'` and HashRouter mean no repo-name config is needed.

## Environment
Windows 11, PowerShell (no `&&`). Do not rewrite source files with PowerShell `Set-Content` (corrupts UTF-8); use the Edit tool.
