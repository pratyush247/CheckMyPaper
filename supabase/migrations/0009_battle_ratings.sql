-- Battle results log + player rating. Every finished battle writes one row per
-- player (also the future training data for smarter matchmaking).
-- Idempotent; service-role only (RLS on, no policies).

alter table students add column if not exists rating int not null default 1000;

create table if not exists battle_results (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null,
  phone text not null,
  score int not null,
  time_ms bigint not null,
  perf real not null,          -- 0-100: 50% accuracy · 30% speed · 20% concept
  rating_after int not null,
  group_code text,             -- squad battles carry their squad
  created_at timestamptz not null default now(),
  unique (battle_id, phone)
);
create index if not exists battle_results_phone_idx on battle_results(phone, created_at desc);
create index if not exists battle_results_group_idx on battle_results(group_code) where group_code is not null;
alter table battle_results enable row level security;
