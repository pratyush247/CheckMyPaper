-- Social slice B: handles, friendships, DM threads/messages, challenges, reports.
-- RLS enabled with no policies (service-role only), matching existing tables.

create table if not exists handles (
  phone text primary key references students(phone) on delete cascade,
  handle text unique not null,
  invite_code text unique not null,
  weak_topics jsonb not null default '[]'::jsonb, -- [{topic, subject}] synced from the device, for common-topic challenges
  created_at timestamptz not null default now()
);
-- If handles already existed from an earlier run, make sure the column is there.
alter table handles add column if not exists weak_topics jsonb not null default '[]'::jsonb;
create index if not exists handles_handle_idx on handles (lower(handle));

create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  requester_phone text not null references students(phone) on delete cascade,
  addressee_phone text not null references students(phone) on delete cascade,
  low_phone text not null,
  high_phone text not null,
  status text not null default 'pending' check (status in ('pending','accepted','blocked')),
  blocked_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (low_phone, high_phone)
);

create table if not exists dm_threads (
  id uuid primary key default gen_random_uuid(),
  a_phone text not null,
  b_phone text not null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  unique (a_phone, b_phone)
);

create table if not exists dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references dm_threads(id) on delete cascade,
  sender_phone text not null,
  body text not null default '',
  kind text not null default 'text' check (kind in ('text','challenge','result','gif')),
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists dm_messages_thread_idx on dm_messages (thread_id, created_at);

create table if not exists challenges (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  creator_phone text not null,
  question_set jsonb not null,
  participant_phones text[] not null,
  status text not null default 'open' check (status in ('open','closed')),
  thread_id uuid references dm_threads(id) on delete set null,
  group_code text,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists challenge_scores (
  challenge_id uuid not null references challenges(id) on delete cascade,
  phone text not null,
  score int not null,
  time_ms int not null,
  played_at timestamptz not null default now(),
  primary key (challenge_id, phone)
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_phone text not null,
  target_phone text not null,
  message_id uuid,
  reason text not null default '',
  created_at timestamptz not null default now()
);

alter table handles enable row level security;
alter table friendships enable row level security;
alter table dm_threads enable row level security;
alter table dm_messages enable row level security;
alter table challenges enable row level security;
alter table challenge_scores enable row level security;
alter table reports enable row level security;
