-- Pilot feedback: quick reactions on AI outputs + free-form suggestions
-- ("what to build next"). Server-only access via the service role.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  phone text,
  name text,
  type text not null,          -- 'reaction' | 'idea' | 'bug' | 'love'
  target text,                 -- e.g. 'insight' | 'tutor' | 'battle' | 'visual' | 'general' | 'next'
  rating text,                 -- 'up' | 'down' | null
  message text,
  created_at timestamptz not null default now()
);
create index if not exists idx_feedback_created on public.feedback (created_at desc);

alter table public.feedback enable row level security;
-- (No policies — service-role only.)
