---
type: okf_log
project: CheckMyPaper
---

# Work Log

Append-only. Newest first.

## 2026-07-18 — v4.4: revise hub + mastery practice + copy fix

- **Bug (field report):** "Add a DeepSeek API key…" appeared in production
  insight notes. Root cause: `diagnose()` fell into the mock branch whenever
  the transcript was EMPTY (student tagged without narrating), not only when
  the key was missing — and the fallback copy was developer-facing. Fix:
  note is now empty in that branch (insight page hides note-less rows);
  every remaining mock string (visual, quiz, tutor banner) reworded
  student-friendly with no key/provider mentions.
- **Revise hub** `/revise/[topic]`: clubs every wrong question of a topic,
  with three NotebookLM-style tools on tabs — Concepts (4-8 concepts behind
  the mistakes, Hinglish Idea/Jaise/JEE-mein explanations), Flashcards
  (10-14 tap-to-flip cards), Mind map (collapsible tree). One API route
  `/api/revise` (kind: concepts|flashcards|mindmap) grounded in the
  student's own wrong questions.
- **Mastery practice** `/revise/[topic]/practice?mode=timed|zen`
  (mastery-learning error-reset drill): 20-question ladder — 5 easy →
  10 medium → 5 hard (`ladder` option on `/api/quiz` and `generateQuiz`) —
  one wrong answer or timeout restarts from Q1 on the same set; timed mode
  = JEE Main pacing (2.4 min/q → 48 min countdown), zen = no clock. Fail
  screen shows pick vs correct + explanation + best-of-session.
- **Entry points:** progress "Revise these next" rows and insight "Topic to
  revisit" now link to the hub.
- Verified live on production: concepts/flashcards/mind map generation,
  correct-answer advance, wrong-answer reset, restart, 48-min countdown.
- Local `next dev` was wedged this session (env issue, zero output, event
  loop parked — unrelated to the diff); verified via Vercel deploy instead.
  `.claude/launch.json` gained `autoPort: true` since a stray server from
  another project held port 3000.
- Deferred: persisting a "mastered" badge per topic; streaming the concept
  generation (first paint is ~40-60s on a cold topic).

## 2026-07-13 — v4.3: field-test fixes round 2

- PlayOnline: bot fallback now joins within ~10s (poll every 5s, summon at
  waited>=5s) instead of the previous 40s+ wait.
- Friends page: bio capped to 15 chars server-side (`/api/social/me`) and
  client-side; renders as a subheading under `@handle` once saved, gated on
  a separate `savedBio` state (the earlier draft-based gate made the input
  vanish mid-keystroke on first save — fixed by splitting draft vs. saved).
- Friends chat (`friends/[handle]`): added "Unfriend" to the ⋯ menu,
  distinct from Block — reuses `respond(... , "decline")` since any
  non-accept/block action deletes the friendship row server-side.
- Duel review (`battle/review/[id]`, `lib/store.ts`): fixed the bug where
  tagging post-duel mistakes created a paper record but never generated its
  insight report, forcing the student to redo the review from the homepage.
  `completeBattleReview` now returns the paperId; the review page calls
  `/api/insight` itself (mirroring `papers/[id]/narrate`) and writes
  `setPaperInsight` in the same flow, then routes straight to
  `/papers/{id}/insight`. A completed review can now be re-tagged up to 2
  times (`editCount` on `BattleReview`), reusing the same paperId so edits
  regenerate the insight in place instead of duplicating papers.

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
- v4.2 correction (same day): mic FAB restored to centre (Ask); Duel is the
  second tab (crossed-swords icon); Duel title top-centred on /battle; all
  visible "battle" wording → "duel" (routes/tables unchanged); coach mic now
  auto-sends the transcript (AI answers in text); Friends page restyled to the
  home card language (purple identity tile, uppercase section headers,
  friend rows as cards).
