-- Synchronous two-player topic vote before a challenge. Both friends see a
-- ballot in the chat thread, each casts one vote; when all have voted the
-- winning topic is resolved and a challenge is auto-created.
create table if not exists challenge_votes (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references dm_threads(id) on delete cascade,
  creator_phone text not null,
  participant_phones text[] not null default '{}',
  options jsonb not null default '[]'::jsonb, -- [{id, topic, subject}]
  votes jsonb not null default '{}'::jsonb,    -- {phone: optionId}
  status text not null default 'open' check (status in ('open','closed')),
  chosen_topic text,
  chosen_subject text,
  challenge_id uuid references challenges(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists challenge_votes_thread_idx on challenge_votes(thread_id);

-- Access is service-role only (bypasses RLS); enabling it blocks anon /
-- authenticated clients we never use. Matches every other social table.
alter table challenge_votes enable row level security;

-- Allow the 'vote' message kind (idempotent — safe if 0005 already ran).
alter table dm_messages drop constraint if exists dm_messages_kind_check;
alter table dm_messages add constraint dm_messages_kind_check check (kind in ('text','challenge','result','gif','vote'));
