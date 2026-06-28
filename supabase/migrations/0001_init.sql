-- CheckMyPaper cloud schema (v1.5 — the sync/auth layer).
-- The MVP runs local-first in the browser; apply this when you want cross-device
-- sync + phone-OTP auth via Supabase. Mirrors src/lib/types.ts.
--
-- Security: every table is owned by a student (auth.uid()) and locked with RLS
-- per the Supabase security checklist (TO authenticated + ownership predicate,
-- UPDATE with both USING and WITH CHECK).

create extension if not exists vector;

-- ---- papers ----------------------------------------------------------------
create table if not exists public.papers (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  status text not null default 'triage' check (status in ('extracting','triage','narrating','done')),
  question_count int not null default 0,
  insight jsonb,
  created_at timestamptz not null default now()
);

-- ---- questions (episodic store) -------------------------------------------
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers (id) on delete cascade,
  student_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  number int not null,
  text text not null,
  subject text not null default 'Unknown',
  topic text not null default 'Unknown',
  subtopic text,
  state text check (state in ('wrong','guessed','skipped')),
  -- RAG layer (later): embedding of question text + narration
  embedding vector(1536)
);

-- ---- attempts (the reasoning capture) -------------------------------------
create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  paper_id uuid not null references public.papers (id) on delete cascade,
  student_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  state text not null check (state in ('wrong','guessed','skipped')),
  transcript text,
  self_tag text,
  ai_tag text,
  ai_confidence real,
  ai_note text,
  skip_reason text,
  created_at timestamptz not null default now(),
  unique (question_id)
);

-- ---- learner_profile (distilled fingerprint) ------------------------------
create table if not exists public.learner_profile (
  student_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---- Row Level Security ----------------------------------------------------
alter table public.papers enable row level security;
alter table public.questions enable row level security;
alter table public.attempts enable row level security;
alter table public.learner_profile enable row level security;

do $$
declare t text;
begin
  foreach t in array array['papers','questions','attempts','learner_profile']
  loop
    execute format($f$
      create policy "own_select" on public.%1$I for select
        to authenticated using ((select auth.uid()) = student_id);
      create policy "own_insert" on public.%1$I for insert
        to authenticated with check ((select auth.uid()) = student_id);
      create policy "own_update" on public.%1$I for update
        to authenticated using ((select auth.uid()) = student_id)
        with check ((select auth.uid()) = student_id);
      create policy "own_delete" on public.%1$I for delete
        to authenticated using ((select auth.uid()) = student_id);
    $f$, t);
  end loop;
end $$;

create index if not exists idx_questions_paper on public.questions (paper_id);
create index if not exists idx_attempts_paper on public.attempts (paper_id);
