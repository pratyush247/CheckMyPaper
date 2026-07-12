-- Social v2: bios, squad invite requests, sticker messages.
-- Idempotent; service-role only (RLS on, no policies) like every social table.

-- Short flauntable bio — shown ONLY on friend requests and post-battle popups.
alter table handles add column if not exists bio text;

-- "Join my squad" requests: a member invites an accepted friend; the friend
-- accepts on their phone and becomes a squad member.
create table if not exists squad_invites (
  id uuid primary key default gen_random_uuid(),
  group_code text not null references public.groups(code) on delete cascade,
  from_phone text not null,
  to_phone text not null,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  unique (group_code, to_phone)
);
create index if not exists squad_invites_to_idx on squad_invites(to_phone);
alter table squad_invites enable row level security;

-- Friends can send stickers in chat.
alter table dm_messages drop constraint if exists dm_messages_kind_check;
alter table dm_messages add constraint dm_messages_kind_check
  check (kind in ('text','challenge','result','gif','vote','sticker'));

-- Challenges record their subject so the syllabus ladder can count prior
-- battles per pair+subject and step up the difficulty.
alter table challenges add column if not exists subject text;

-- Topic voting is replaced by the syllabus ladder.
drop table if exists challenge_votes;
