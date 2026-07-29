---
type: okf_index
project: CheckMyPaper
generated: 2026-06-29
source: _setup/global_okf_scaffold.md
---

# CheckMyPaper — Architecture Index (OKF)

Local knowledge index for agents. JEE mistake-diagnosis PWA: scan a mock →
triage mistakes → narrate by voice → AI insight → battle stages → tutor.
Local-first (browser store) with a Supabase backend for multiplayer + tutor RAG.

> Note: root `AGENTS.md` / `CLAUDE.md` are the project's existing instruction
> files and are intentionally **not** managed by this scaffold (repo is not an
> empty folder). See `log.md`.

## Stack
- **Next.js 16** (App Router) · **React 19** · **Tailwind v4** · TypeScript
- Installable **PWA** (`public/manifest.webmanifest`, `public/sw.js`)
- **Providers (via OpenRouter, 1 key):** `deepseek/deepseek-v4-flash` (text: structuring, diagnosis, quiz — reasoning disabled), `google/gemini-2.5-flash` (OCR), `google/gemini-2.5-flash-lite` (SVG visuals), `openai/text-embedding-3-small` (tutor embeddings). **Sarvam** = STT + TTS.
- **Supabase** (server-only, service-role) for multiplayer + tutor pgvector + feedback.

## Architecture layers
1. **Local-first store** (`src/lib/store.ts`) — source of truth on device via `localStorage`: papers, questions, attempts, learner profile, account, battle progress. Reactive via `useStore.ts`.
2. **Server AI routes** (`src/app/api/*`) — all AI + DB access; each degrades to a mock/no-op when its key is missing.
3. **Supabase backend** (`src/lib/supabaseServer.ts` + `supabase/migrations/*`) — shared multiplayer, tutor RAG, feedback. Browser never touches Supabase directly.

## Page routes (`src/app`)
- `page.tsx` — home: paper list + top-line insight + profile button
- `login/page.tsx` — name+phone local account (trust-based, no OTP)
- `profile/page.tsx` — account, stats, dark-mode toggle, Friends squads, feedback form, logout
- `papers/new` — add paper (photo/PDF upload → extract); `papers/[id]/triage` → `/narrate` → `/insight`
- `progress/page.tsx` — cross-paper mistake trend + revise list
- `battle/page.tsx` — weak-topic stage map; `battle/[topic]/page.tsx` — lesson → 10-Q timed quiz → result + leaderboard
- `ask/page.tsx` — voice doubt-solver (visual + spoken)
- `tutor/page.tsx` — "chat with your mistakes" (RAG)
- `admin/feedback/page.tsx` — token-gated feedback review (exempt from login gate)

## API routes (`src/app/api`)
| Route | Purpose | Backing |
|---|---|---|
| `extract` | paper image → questions+topics | Gemini OCR + DeepSeek structure |
| `diagnose` | per-question mistake tag + note | DeepSeek |
| `insight` | per-paper headline + advice | DeepSeek (+ deterministic fallback) |
| `transcribe` | voice → text (WAV) | Sarvam STT / Whisper fallback |
| `tts` | text → speech | Sarvam TTS |
| `visual` | prompt → SVG + explanation | Gemini flash-lite |
| `quiz` | 10 topic MCQs | DeepSeek |
| `battle/score` | record score | Supabase |
| `leaderboard` | global/group ranking | Supabase |
| `group` | create/join/list squads | Supabase |
| `tutor/sync` | embed+upsert mistakes | embeddings + Supabase |
| `tutor/chat` | RAG answer over mistakes | embeddings + `match_mistakes` + DeepSeek |
| `feedback` | submit / token-gated list | Supabase |

## lib modules (`src/lib`)
- `types.ts` — domain types (Account, Paper, Question, Attempt, LearnerProfile, tags)
- `store.ts` — local-first CRUD + `computeProfile()` + weak-topics + battle progress + `getAllMistakes()`
- `useStore.ts` — reactive bridge + `useMounted` (hydration-safe)
- `ai.ts` — extraction/diagnosis/insight/visual/quiz + `deepseekChat` (mock fallbacks)
- `llm.ts` — OpenAI-compatible chat client (`disableReasoning` for DeepSeek)
- `embeddings.ts` — text-embedding-3-small via OpenRouter
- `supabaseServer.ts` — service-role client (server-only)
- `multiplayer.ts`, `battle.ts` — client leaderboard/squad helpers + seeded fallback
- `tutor.ts`, `feedback.ts` — client helpers
- `recorder.ts` + `wav.ts` — mic → 16kHz WAV (Sarvam-compatible)
- `pdf.ts` — client PDF→page-images (pdf.js) before OCR
- `theme.ts` — dark mode (runtime CSS-var override + pre-paint script)
- `errorTags.ts`, `sampleData.ts` — taxonomy + demo data

## Data model
- **Local (device):** papers, questions, attempts, learner_profile, account, battle progress
- **Supabase migrations:** `0001_init` (auth-based, superseded/unused), `0002_multiplayer` (students, battle_scores, groups, group_members), `0003_tutor` (mistakes + `embedding vector(1536)` + `match_mistakes()` RPC), `0004_feedback` (feedback). RLS enabled, no policies (service-role only).

## Env vars
`DEEPSEEK_API_KEY` (+ `_BASE_URL`/`_MODEL`), `DEEPSEEK_OCR_*`, `VISUAL_*`,
`EMBED_*` (all OpenRouter) · `SARVAM_API_KEY` (+ TTS opts) · `SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY` · `ADMIN_TOKEN`. Full template: `.env.example`.

## Deploy
GitHub `pratyush247/CheckMyPaper` (private) → Vercel `https://checkmypaper.vercel.app`.
Redeploy: `vercel --prod` (CLI at `~/.hermes/node/bin/vercel`). Auto-deploy on push not connected.

## v4.1 delta (2026-07-12)
- **Realtime:** `src/lib/realtimeClient.ts` (browser subscribe: useRealtime,
  useFocusRefetch) + `broadcast()` in `src/lib/supabaseServer.ts` (HTTP
  Broadcast, service-role). Channels: `dm:{threadId}`, `squad:{code}`,
  `battle:{challengeId}`, `user:{phone}`. No polling remains.
- **Syllabus:** `src/lib/syllabus.ts` — static JEE syllabus + pickChallengeTopic
  (common weak → ladder, difficulty tiers). Voting system deleted.
- **Rating:** `src/lib/rating.ts` — perfScore (50/30/20) + eloUpdate; settled in
  `api/social/challenge/score`; stats via `api/battle/stats` (?phone|?code|?global).
- **Matchmaking:** `api/battle/match` + `match_queue`; UI `components/PlayOnline.tsx`.
- **Social v2:** friends-only squads + `squad_invites` (api/group actions
  invite/respondInvite), bios (`api/social/me` POST), `api/social/peers`
  (post-battle friend popup), stickers (dm kind `sticker`).
- **Battle review:** store fns in `src/lib/store.ts` (BattleReview*), page
  `app/battle/review/[id]`, home pending tile.
- **UI:** `components/BattleStats.tsx` (squad/personal/global boards),
  `components/PullToRefresh.tsx`, swipe-nav inside `components/BottomNav.tsx`.
- **Migrations:** 0008 (bio, squad_invites, sticker kind, challenges.subject,
  drop challenge_votes), 0009 (rating + battle_results), 0010 (match_queue).
- **Env (new, browser-safe):** NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY.

## v4.2 delta (2026-07-12)
- **Nav:** centre FAB = Duel (/battle); "Ask" is a regular tab (recorder FAB
  returns on /ask via the `mic` prop). Labels say "Duel", routes unchanged.
- **Practice bots:** `api/battle/match` action `bot` (after 40s alone) →
  solo challenge + `?bot=<name>`; simulation + close-loss standings live in
  `app/battle/challenge/[id]/page.tsx` (client-only, no server scores).
- **Anti-double-match:** matchedRef guard in `PlayOnline.tsx`; server `join`
  returns an existing live unplayed lobby (<30 min) instead of re-queueing.
- **Live rival box:** `api/social/challenge/progress` → broadcast `progress`
  on `battle:{id}`; posted from choose() on each answer.
- **Global pull-to-refresh:** `PullToRefresh` (onRefresh optional → reload)
  wraps children in `app/layout.tsx`.
- **Username change:** `api/social/handle` POST accepts `change: true`;
  UI in Friends "You are" card. `HomeButton` added to `components/ui.tsx`.
- **Coach:** background sync (instant chat), card-style replies, mic input
  (`useRecorder`), follow-up-first persona prompt in `api/tutor/chat`.

## v4.3 delta (2026-07-13)
- **Bot fallback speed:** `components/PlayOnline.tsx` poll interval 10s→5s,
  bot-summon threshold 40s→5s waited-alone (session forms in ~10s total).
- **Bio:** capped to 15 chars in `api/social/me` POST and client input;
  Friends "You are" tile now shows the saved bio as a subheading under
  `@handle` with an "Edit bio" toggle, gated on a `savedBio` state kept
  separate from the input draft (draft-only gating made the field vanish
  mid-keystroke on first save).
- **Unfriend:** `friends/[handle]/page.tsx` ⋯ menu — reuses
  `respond(phone, friendshipId, "decline")` (any non-accept/block action
  deletes the friendship row server-side), distinct from Block.
- **Duel review, one-shot report + edits:** `lib/store.ts`
  `completeBattleReview()` now returns the paperId (or `null` if the edit
  cap is used up) instead of void; `BattleReview` gained `paperId` and
  `editCount`. `app/battle/review/[id]/page.tsx` calls `/api/insight`
  itself right after tagging (mirroring `papers/[id]/narrate`) and writes
  `setPaperInsight` in the same flow — previously the paper record was
  created but never got an insight, so opening it from the homepage always
  read "not reviewed yet." A completed review can be re-tagged up to 2
  times; edits reuse the same paperId (old questions/attempts for that
  paperId are dropped and rewritten) so the report regenerates in place
  instead of duplicating papers. Entry point button in
  `battle/challenge/[id]/page.tsx` switches from "Review your mistakes" to
  "Edit review (n left)" once done.

## v4.4 delta (2026-07-18)
- **Revise hub:** `app/revise/[topic]` (clubbed wrong questions + tool tabs)
  backed by `api/revise` (kind: concepts | flashcards | mindmap, grounded in
  the student's wrong questions; Hinglish concept explanations). Entry
  points: progress "Revise these next" rows, insight "Topic to revisit".
- **Mastery practice:** `app/revise/[topic]/practice?mode=timed|zen` —
  20-question difficulty ladder (5 easy/10 medium/5 hard) via the new
  `ladder` option on `api/quiz` / `generateQuiz` (`lib/ai.ts`); any wrong
  answer (or the 48-min JEE-pace countdown in timed mode) restarts the run
  from Q1 on the same set.
- **Copy fix:** `diagnose()` in `lib/ai.ts` no longer emits "Add a DeepSeek
  API key…" for empty-transcript tags (note omitted; insight hides the
  row); all mock fallback strings are now student-safe.
- `.claude/launch.json`: `autoPort: true`.

## v4.5 delta (2026-07-20)
- **Revise home:** `app/revise/page.tsx` — suggested weak topics (top 5,
  mistake counts + subject tags) + full JEE syllabus browser (subject +
  Class 11/12/All chips defaulting from the profile; chapter cards expand
  to "Full chapter" + subtopic chips). Home REVISE tile always shows and
  links here.
- **Syllabus subtopics:** `lib/syllabus.ts` — `SyllabusTopic.sub: string[]`
  (3-5 per chapter, all subjects) + `findSubjectFor(name)` (chapter or
  subtopic → subject). Hub + practice pages use it as the subject fallback
  after weak topics, so any syllabus pick powers concepts / flashcards /
  mind map / both mastery modes.
