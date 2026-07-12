-- Play Online matchmaking queue: one row per waiting player.
-- Idempotent; service-role only (RLS on, no policies).

create table if not exists match_queue (
  phone text primary key,
  klass text not null,
  subject text not null,
  topic text,                  -- null = "surprise me"
  size int not null default 2, -- lobby size: 2/4/6/8
  rating int not null default 1000,
  enqueued_at timestamptz not null default now()
);
create index if not exists match_queue_key_idx on match_queue(subject, size, klass);
alter table match_queue enable row level security;
