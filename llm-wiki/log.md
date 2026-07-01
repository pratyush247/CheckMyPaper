---
type: okf_log
project: CheckMyPaper
---

# Work Log

Append-only. Newest first.

## 2026-06-29
- Scaffolded `llm-wiki/` (index.md + log.md) from `_setup/global_okf_scaffold.md` and cataloged the current architecture.
- **Skipped scaffold steps 1–2** (generate `AGENTS.md` with `<!-- SYSTEM_LOCK -->` barriers, `CLAUDE.md` pointer): the scaffold targets a *new empty folder*, but this repo already has meaningful `AGENTS.md`/`CLAUDE.md`. Overwriting them would be destructive and off-spec — left untouched pending explicit confirmation.

## Recent build history (from git)
- `b7a3b7a` Pilot feedback system (thumbs + suggest form + /admin review)
- `fcd923b` "Chat with your mistakes" tutor (pgvector RAG)
- `ff98c28` Supabase multiplayer: leaderboards + friend squads
- `7d8f9f8` Fix pilot bugs (voice webm→WAV, quiz timeout, visual overlap, Ask UX)
- `8af6738` Visual voice doubt-solver + Battle Mode
- `9485e4e` Login, profile, dark mode
- `00dafcc` Providers → DeepSeek (OCR + V4 Flash) + Sarvam voice
- `7e5d97f` Initial MVP (scan → triage → narrate → insight → progress)
