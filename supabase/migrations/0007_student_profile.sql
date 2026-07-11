-- Student self-reported profile: class (Class 11 / Class 12 / Dropper) and the
-- subject they find hardest. Used to pitch curated papers at the right level and
-- to seed the future teaching agent's per-student memory.
alter table public.students add column if not exists class text;
alter table public.students add column if not exists weak_subject text;
