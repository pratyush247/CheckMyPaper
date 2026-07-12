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
- `wip` Redesign UI → Antigravity "Liftoff" language: monochrome + one blue accent, solid-ink pill CTAs, calm tonal tiles, refined light display type. Token-driven re-skin (globals.css + layout fonts + FAB); no page/logic changes. See DESIGN.md
- `wip` Ask UX: white FAB is now the recorder (breathe/glow idle, red pulse recording, floating status); removed redundant blue mic. Added loading skeleton so visual gen never feels frozen. Hinglish structured explanation (Idea/Jaise/Isliye + example). App-wide motion (fade-in per screen, staggered home grid, reduced-motion safe).
- `wip` Social slice: /friends + chat + friend-challenges UI wired. Fixed dev-hang (font via browser `<link>`, not next/font), "Load failed" resilience (fetch retry + stale-SW cleanup), opaque handle-claim error. Added first-run @handle modal (HandleGate), common-weak-topic challenges (weak_topics synced per handle, intersected server-side) with subject/custom-topic fallback, dev seed button. Narrate page section-header spacing. Deferred work in `deferred.md`.

## 2026-07-12 — v4.1: Realtime social + Play Online (7 phases, one session)
- Phase 0 fixes: chat de-dupe (merge by id), per-viewer challenge state (D1),
  back→home after results (D5), coach markdown rendering + structured prompt.
- Realtime: Supabase Broadcast replaces ALL polling (dm/squad/battle/user
  channels; anon key = channels only, RLS keeps tables closed).
- Social v2: friends-only squads (join code gated on owner friendship, squad
  invite requests), bios (friend-request contexts only), stickers, post-battle
  friend popup. Personal invite links removed. Migration 0008.
- Syllabus ladder replaced topic voting: static JEE syllabus in
  src/lib/syllabus.ts; common weak topics first, difficulty +1 every 3 battles.
- Battle review (~30s tap-tag) writes real paper/question/attempt records —
  coach + weak topics learn from battles; home "review pending" tile.
- Rating: perf = 0.5 acc + 0.3 speed + 0.2 concept; Elo-lite; battle_results
  (0009). Squad/personal/global leaderboards.
- Play Online: match_queue (0010), ±150 rating window widening every 10s,
  lobbies 2/4/6/8, "start with N" after 30s, anonymous usernames.
- Polish: swipe nav between tabs (BottomNav), PullToRefresh on Friends.
- Migrations to run: 0008, 0009, 0010. New env: NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY (Vercel + .env.local).

## 2026-07-12 — v4.2: Duel polish (post-field-test fixes)
- Nav: centre FAB is now Duel (/battle, swords); mic moved to a regular "Ask"
  tab (still becomes the recorder on /ask). "Battle Mode" → "Duel".
- Match glitch root cause fixed: a stale 10s poll re-enqueued an already-matched
  player into a second lobby (screen reset + different questions). Client now
  navigates exactly once (matchedRef) and leaves the queue; server "join"
  returns the player's existing live lobby instead of re-queueing.
- Practice bots: after 40s alone in queue, action:"bot" creates a solo
  challenge (?bot=name); rival is simulated client-side, always loses by a
  close margin, never touches leaderboards/friends/server scores.
- Live rival box during quizzes: /api/social/challenge/progress broadcasts
  answered/score/time on battle:{id}; small fixed card top-right.
- Global PullToRefresh in root layout (reload fallback, inner-scroller guard);
  per-page instance removed from Friends.
- Friends: HomeButton (ui.tsx) beside back; username change (handle route
  accepts change:true when the new handle is free).
- Coach: usable instantly (sync runs in background, "building your memory"
  pulse), replies render as full-width cards, mic button (useRecorder →
  transcript into input), persona prompt asks 1-2 follow-ups before answering
  and checks in until clear.
