-- ═══════════════════════════════════════════════════════════════════
-- One Supabase project, several apps. Paste this whole file into
-- Supabase > SQL Editor > New query > Run. Safe to run more than once.
--
--   App 1: CaliTrack      tables: profiles, food_logs, activity_logs, weight_logs, saved_meals, custom_foods
--   App 2: NAMONEY        tables: fin_*  (prefix `fin_`)
--
-- Convention for the next app: prefix its tables (e.g. `todo_`) so they never collide.
-- Every row carries user_id and Row Level Security (RLS) limits each signed-in user to their own rows.
-- The publishable key in a web app is public by design; RLS is what keeps the data private.
-- ═══════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════
-- App 1: CaliTrack (copied unchanged from the CaliTrack project so its app needs no code changes)
-- Client tạo id (uuid) và updated_at; xoá = soft delete (deleted_at).
-- ═══════════════════════════════════════════════════════════════════

-- Bảng của bản draft cũ (chưa từng được app ghi dữ liệu). Bỏ comment nếu muốn dọn:
-- drop table if exists meal_logs, food_dictionary, user_profiles;

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  sex text not null default 'male',
  age int not null default 25,
  height_cm double precision not null default 170,
  weight_kg double precision not null default 65,
  neat double precision not null default 1.375,
  goal text not null default 'bulk',
  protein_per_kg double precision not null default 2.0,
  overrides jsonb not null default '{}'::jsonb,
  exercise_eat_back_pct double precision not null default 50,
  updated_at timestamptz not null default now()
);

create table if not exists food_logs (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  date date not null,
  meal text not null,
  name text not null,
  emoji text not null default '🍽️',
  food_id text,
  grams double precision not null default 0,
  serving_label text,
  source text not null default 'db',
  kcal double precision not null default 0,
  protein double precision not null default 0,
  carbs double precision not null default 0,
  fat double precision not null default 0,
  fiber double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists food_logs_user_date on food_logs (user_id, date);
create index if not exists food_logs_user_updated on food_logs (user_id, updated_at);

create table if not exists activity_logs (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  date date not null,
  activity_id text not null,
  name text not null,
  emoji text not null default '⏱️',
  minutes double precision not null default 0,
  intensity text not null default 'moderate',
  met double precision not null default 0,
  kcal double precision not null default 0,
  manual boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists activity_logs_user_updated on activity_logs (user_id, updated_at);

create table if not exists weight_logs (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  date date not null,
  kg double precision not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists weight_logs_user_updated on weight_logs (user_id, updated_at);

create table if not exists saved_meals (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  name text not null,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists custom_foods (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  name text not null,
  emoji text not null default '🍽️',
  category text not null default 'dish',
  per100 jsonb not null,
  servings jsonb not null default '[]'::jsonb,
  default_grams double precision not null default 100,
  aliases jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Row Level Security (CaliTrack)
alter table profiles enable row level security;
alter table food_logs enable row level security;
alter table activity_logs enable row level security;
alter table weight_logs enable row level security;
alter table saved_meals enable row level security;
alter table custom_foods enable row level security;

drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['food_logs','activity_logs','weight_logs','saved_meals','custom_foods'] loop
    execute format('drop policy if exists "own rows" on %I', t);
    execute format(
      'create policy "own rows" on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;


-- ═══════════════════════════════════════════════════════════════════
-- App 2: NAMONEY (tables prefixed `fin_`)
-- ═══════════════════════════════════════════════════════════════════

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

-- Row Level Security (NAMONEY): signed-in users see and change only their own rows; anonymous visitors get nothing.
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
