-- "Chat with your mistakes" tutor — pgvector RAG over the student's own mistakes.
-- Server-only access (service role). Embeddings: openai/text-embedding-3-small (1536).

create extension if not exists vector;

create table if not exists public.mistakes (
  id uuid primary key default gen_random_uuid(),
  phone text not null references public.students (phone) on delete cascade,
  source_id text not null,            -- the device-local attempt id (idempotent sync)
  question_text text not null,
  transcript text,
  topic text,
  subject text,
  error_tag text,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  unique (phone, source_id)
);

create index if not exists idx_mistakes_phone on public.mistakes (phone);
create index if not exists idx_mistakes_embedding on public.mistakes using hnsw (embedding vector_cosine_ops);

alter table public.mistakes enable row level security;
-- (No policies — service-role only, same as the multiplayer tables.)

-- Nearest mistakes for a student, by cosine similarity.
create or replace function public.match_mistakes(
  query_embedding vector(1536),
  match_phone text,
  match_count int default 6
)
returns table (
  question_text text,
  transcript text,
  topic text,
  subject text,
  error_tag text,
  similarity float
)
language sql stable
as $$
  select m.question_text, m.transcript, m.topic, m.subject, m.error_tag,
         1 - (m.embedding <=> query_embedding) as similarity
  from public.mistakes m
  where m.phone = match_phone and m.embedding is not null
  order by m.embedding <=> query_embedding
  limit match_count;
$$;
