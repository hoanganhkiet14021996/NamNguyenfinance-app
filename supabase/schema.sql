-- Personal CFO: Supabase schema. Tables are prefixed `fin_` so one Supabase project can host several apps.
-- Paste this whole file into Supabase > SQL Editor > New query > Run. Safe to run more than once.
--
-- Every row carries user_id and Row Level Security (RLS) limits each signed-in user to their own rows.
-- The publishable key in the web app is public by design; RLS is what keeps the data private.

create table if not exists public.fin_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  prefs jsonb not null default '{}'::jsonb,
  plan jsonb not null default '{}'::jsonb,
  dismissed_insights text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.fin_accounts (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  name text not null,
  institution text not null default '',
  type text not null check (type in ('cash', 'bank', 'credit_card', 'investment', 'loan')),
  opening_balance numeric not null default 0,
  archived boolean not null default false,
  updated_at text not null default '',
  primary key (user_id, id)
);

create table if not exists public.fin_categories (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  name text not null,
  kind text not null check (kind in ('income', 'expense')),
  icon text not null default '',
  color text not null default '',
  primary key (user_id, id)
);

create table if not exists public.fin_transactions (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  type text not null check (type in ('income', 'expense', 'transfer')),
  date date not null,
  amount numeric not null check (amount >= 0),
  description text not null default '',
  category_id text,
  account_id text not null,
  to_account_id text,
  notes text,
  merchant text,
  tags text[] not null default '{}',
  primary key (user_id, id)
);
create index if not exists fin_transactions_user_date_idx on public.fin_transactions (user_id, date desc);

create table if not exists public.fin_budgets (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  month text not null, -- 'YYYY-MM' or 'all' (recurring)
  category_id text not null,
  amount numeric not null default 0,
  primary key (user_id, id)
);

-- Row Level Security: signed-in users see and change only their own rows; anonymous visitors get nothing.
do $$
declare
  t text;
begin
  foreach t in array array['fin_settings', 'fin_accounts', 'fin_categories', 'fin_transactions', 'fin_budgets'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end $$;
