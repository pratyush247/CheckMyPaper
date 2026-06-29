-- CheckMyPaper multiplayer (trust-based phone identity, no Supabase Auth).
-- ALL access is server-side via the service-role key, which BYPASSES RLS.
-- We still enable RLS with NO policies, so the anon/public API cannot read or
-- write these tables directly — the Next.js API is the only door in.

create table if not exists public.students (
  phone text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.battle_scores (
  id uuid primary key default gen_random_uuid(),
  phone text not null references public.students (phone) on delete cascade,
  topic text not null,
  score int not null check (score between 0 and 10),
  time_ms int not null,
  created_at timestamptz not null default now()
);
-- Leaderboard ordering: highest score, then fastest time.
create index if not exists idx_scores_topic on public.battle_scores (topic, score desc, time_ms asc);
create index if not exists idx_scores_phone on public.battle_scores (phone);

create table if not exists public.groups (
  code text primary key,
  name text not null,
  owner_phone text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_code text not null references public.groups (code) on delete cascade,
  phone text not null references public.students (phone) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_code, phone)
);
create index if not exists idx_members_phone on public.group_members (phone);

alter table public.students enable row level security;
alter table public.battle_scores enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
-- (No policies on purpose — service-role only.)
