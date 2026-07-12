# BUILD PROMPT — CheckMyPaper v4.1: "Squads, Play Online & the Battle Loop"

Branch: `feat/social-peer-connect` (continue). Stack: Next.js 16 App Router, React 19,
Tailwind v4, localStorage-first, Supabase server-only (service-role). Ponytail rules apply:
smallest working diff, reuse existing helpers, one runnable check per non-trivial unit.

Item codes (A1–F3) map to the agreed requirements list. Build in phase order —
each phase ships independently and is committed separately.

---

## Locked decisions

- **Voice calls: DEFERRED** (real WebRTC voice later; log in `llm-wiki/deferred.md` with the trigger "build when squads retain"). Chat + GIFs/stickers ship now.
- **ML matchmaking: DEFERRED** — for now a transparent rating formula; log every battle so a predictive model can be trained later when data exists.
- **Realtime: Supabase Realtime replaces ALL polling** (chat, squad membership, battle state, vote-free challenge flow). Broadcast/postgres_changes over a public anon-key channel is NOT allowed to leak data — use Realtime **Broadcast** channels keyed by non-guessable ids (dm pair key, squad code, battle id), sent from the server via `supabase.channel().send()` with the service role, received in the browser with the **anon key limited to Realtime only** (add `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`; RLS stays on with no table policies so the anon key can read/write nothing — it can only join broadcast channels).
- **Topic voting is REMOVED** — replaced by the syllabus ladder (Phase 3).
- **Battle review = lighter than mock review** (MCQs), but still written to the student log / memory.
- **Ranking = accuracy + speed + concept-understanding** (formula in Phase 5).
- **Swipe navigation** between bottom-nav tabs: Home ↔ Battle ↔ Progress ↔ Profile.

---

## Phase 0 — Bug fixes (do first; each is small)

### 0.1 Chat de-dupe (C1)
Messages appear ~3×. Root-cause it before patching: suspects are (a) the send handler
firing on both keydown-Enter and button click, (b) React 19 StrictMode double-invoke +
non-idempotent send, (c) the poll merging optimistic + server copies without a key.
Fix at the source: give every message a **client-generated `client_id` (crypto.randomUUID())**,
send it with the POST, add a unique index `dm_messages(client_id)` (migration 0008),
upsert on conflict do nothing, and de-dupe the client list by `client_id`. This makes
send idempotent regardless of which UI path double-fires.

### 0.2 Chat latency (C2)
Solved properly by Phase 1 (Realtime). Until then: optimistic append on send (already
have the message locally — render immediately, reconcile by `client_id`).

### 0.3 Recipient can't play (D1)
In the challenge flow, when the creator has finished, the peer sees no Play option.
Trace `src/app/battle/challenge/*` + the challenge card in `src/app/friends/[handle]/page.tsx`:
the card must show per-viewer state — "Play now" if *I* haven't played, "Waiting for @x"
if I played and they haven't, "See results" when both done. Fix the state derivation
(it's currently keyed to the creator's completion, not the viewer's).

### 0.4 Back button after results (D5)
Once a challenge's results exist, entering the challenge page redirects to results;
and from the results screen, Back goes **home**. Implementation: results page does
`router.replace` (never push) when transitioning from play → results, so the play
screen is not in history; the results TopBar back target is `/`.

### 0.5 Coach output rendering (F1, F2)
`src/app/tutor/page.tsx` renders raw markdown. Two fixes:
1. Render markdown properly — use `react-markdown` ONLY if already installed; otherwise
   write a ~30-line mini renderer (bold, lists, paragraphs) — no new dependency for this.
2. Fix the prompt: system prompt must forbid internal tag names (`calc_slip` →
   "calculation slip"), demand structure: **one-line headline → 2-3 short sections with
   bold lead-ins → one action step**. Max ~150 words per reply unless asked.

---

## Phase 1 — Supabase Realtime everywhere (A3, C2)

- Add browser Supabase client (`src/lib/supabaseBrowser.ts`) using anon key, Realtime only.
- Server: after any mutation (message insert, squad join/leave, battle finish, friend
  request), broadcast an event on the relevant channel:
  - `dm:{low}_{high}` — chat messages (payload = the message row)
  - `squad:{code}` — membership changes (payload = updated member list)
  - `battle:{id}` — battle state changes
  - `user:{phone}` — things addressed to one person (friend request received, squad invite)
- Client hooks: `useRealtime(channel, onEvent)` — one small hook, subscribe on mount,
  unsubscribe on unmount. Replace ALL `setInterval` polling in chat, vote (being deleted
  anyway), squad member list, and challenge status.
- Fallback: keep one slow refetch on window focus (`visibilitychange`) so a missed
  broadcast self-heals. No interval polling remains.

## Phase 2 — Social model rework (A1, A2-flow, B2, B3, B4)

**The flow (locked):** claim unique @username → add friends by username → create squad →
squad joined ONLY by friends, via (a) squad code entry — server verifies the joiner is an
accepted friend of at least the owner, or (b) **squad invite request**: owner/member picks a
friend, request lands on friend's phone (Realtime `user:{phone}`), friend accepts → joins.

- **A1:** delete the personal invite link/code UI + `?add=CODE` deep link + its API path.
  Squad code (`TQRVTS`) is the only shareable code.
- **Join guard:** `join` action now requires an accepted friendship with the squad owner
  (or any existing member — owner is fine, simplest). Non-friends get
  "Add @owner as a friend first".
- **Squad invites (new):** `squad_invites` table (migration 0008): `id, group_code,
  from_phone, to_phone, status(pending/accepted/declined), created_at`. API actions
  `invite`, `respond`. UI: on the squad card, "Invite" next to each friend not in the
  squad; invitee sees an inline "Squad invite from @x — Accept / Decline" card (Realtime).
- **B2/B3 — post-battle friend popup:** after a battle with non-friends (Play Online,
  Phase 6) or squad battles, results screen shows "Add @x as a friend?" per non-friend
  player, with their **bio** (B4). Recipient gets the standard accept/decline (already
  built) — reuse `friendships` + the existing respond endpoint.
- **B4 — bios:** `handles.bio text` (migration 0008, ≤120 chars). Editable on the profile
  page under the @handle. Privacy rule: non-friends see ONLY `@username`; the bio is
  exposed exclusively inside friend-request payloads (incoming request card shows bio)
  and on the post-battle popup. Search results show username only.
- **Chat extras for friends:** GIFs/stickers = a small fixed sticker pack (12–20 bundled
  emoji-style stickers in `/public/stickers/`, message kind `"sticker"`, payload = sticker
  id). NO external GIF API (Giphy needs a key + moderation — deferred, log it).

## Phase 3 — Syllabus ladder replaces topic voting (locked)

Delete the voting system: `challenge_votes` usage, vote API routes, VoteCard/TopicPicker
voting UI, `vote` message kind sends (keep DB kind for old rows). Migration 0008 may
drop the table (or leave it dead — leaving it is fine, note it).

Replace with:
- **`src/lib/syllabus.ts`** — the full JEE syllabus as a typed constant:
  `{ subject: "Physics"|"Chemistry"|"Maths", klass: "Class 11"|"Class 12", topics:
  [{ name, difficulty: 1|2|3 }] }` — ordered beginner → advanced within each subject/class.
  (~90 topics total; write it once, it's static data.)
- **Challenge start flow:** student picks a **subject** → server picks the topic:
  1. intersect both players' `weak_topics` in that subject (common weak areas first),
  2. else the earliest not-yet-played syllabus topic for their class,
  3. difficulty ladder: per player-pair, start at difficulty 1 in that subject and step
     up after each completed battle in it (track in `challenges` rows — count prior
     battles per pair+subject; no new table).
- Paper generation: existing `generateQuiz(topic, subject, n, {className})` — pass the
  chosen topic + shared class (if classes differ, use the lower class).

## Phase 4 — Battle review + memory (D2, D3, D4, F3)

- **Light review flow** (`/battle/review/[id]`): after results, "Review your mistakes →".
  For each wrong answer: question, your pick vs correct, one tap-chip self-tag (same 6
  chips as mock triage: concept/calc/misread/method/time/second-guess), optional one-line
  note. ~30 seconds total. Then back to Friends.
- **Write to memory (D4/F3):** each reviewed battle question becomes an episodic record in
  the same store the mock papers use (localStorage attempts + the tutor sync path), tagged
  `source: "battle"`. Weak-topic computation and the coach's context MUST include battle
  records — the coach prompt already receives weak topics; extend the sync
  (`syncWeakTopics` / tutor embeddings) to include battle attempts.
- **D3 — home "Review pending" card:** if any finished battle has unreviewed wrong answers,
  home page shows one card "⚔️ Battle review pending — 2 min" linking to the review.
  Zero pending → card fully hidden. State from localStorage (list of finished-but-unreviewed
  battle ids).

## Phase 5 — Rating + leaderboards + analytics (E1, E2, E3, algorithm)

**Per-battle performance score** (0–100):
`perf = 100 * (0.5*accuracy + 0.3*speedFactor + 0.2*concept)`
- `accuracy` = correct/total.
- `speedFactor` = clamp01(median_expected_time / your_time) — expected time = 60s/question
  baseline scaled by difficulty (1/1.25/1.5).
- `concept` = 1 − (concept-tagged errors / total errors), from the battle review; if the
  review is skipped, concept = accuracy (neutral). This makes reviewing strictly
  rating-relevant → incentive to review.

**Rating** (per student, one number, drives Play Online matchmaking): Elo-lite.
Start 1000. After each multi-player battle, treat it as pairwise matches by perf score:
`new = old + K * (actual − expected)`, K=32, expected via standard Elo formula on current
ratings. Store per battle in a `battle_results` table (migration 0008): `battle_id, phone,
score, time_ms, perf, rating_after, created_at`.

- **E1 — squad leaderboard + analytics:** on the squad card (or a tab within Friends):
  rank members by avg perf (last 10 battles), show battles played, accuracy, streak.
- **E2 — personal analytics:** on Progress (or Profile): card-style stats — current rating,
  total battles, win rate, avg accuracy, avg speed, best subject, weakest subject,
  per-squad rank chips. Home-page card visual language (E3).
- **E4 — platform leaderboard:** Play Online tab shows a global live top-N by rating
  (Realtime-refreshed), plus "your rank #x of y".

## Phase 6 — Play Online (anonymous matchmaking)

New card on Battle tab: **"Play Online 🌐"**.
- Student picks **lobby size** (2/4/6/8) + filters: **Class, Subject, Topic** (topic
  optional — default "surprise me" = matchmaker picks from their weak topics).
- **Matchmaking:** `match_queue` table (migration 0008): `phone, klass, subject, topic,
  size, rating, enqueued_at`. Server matches FIFO within ±150 rating (widen +50 every
  10s of waiting), same class+subject (+topic if set). When `size` players match, create
  a battle (reuse the challenge/battle machinery, multi-player), notify via
  `user:{phone}` Realtime, everyone plays the same generated paper simultaneously.
- **Anonymous:** players see each other ONLY as `@username`. No chat, no voice — pure
  realtime competition (live per-question progress ticker via `battle:{id}` broadcast
  is enough; keep it simple: show "3/5 answered" per player).
- Post-battle: results + rating change + the friend-request popup (Phase 2 B2) + review
  flow (Phase 4).
- Min 2 players (A6): a lobby of 2 is a valid match; battle can also start with a
  "start anyway" if the queue delivers ≥2 and the user opts to begin after 30s wait.

## Phase 7 — UX polish (A4, A5, D6, E3)

- **A5/E3 — card language:** audit Friends page + new leaderboard/analytics against the
  home page's `.card` / `.tile` / section-header idiom; make them visually identical
  (spacing, radii, typography). No new CSS primitives — reuse `globals.css` classes.
- **A4 — pull-to-refresh:** small touch handler on scrollable pages (Friends, chat,
  Battle): overscroll-at-top drag ≥70px → spinner → refetch. One shared component
  `<PullToRefresh onRefresh>`. CSS `overscroll-behavior` tuned so it doesn't fight
  the browser's native reload.
- **D6 — swipe nav:** horizontal swipe (≥60px, mostly-horizontal) on the main tab pages
  navigates Home ↔ Battle ↔ Progress ↔ Profile in tab order. One shared hook
  `useSwipeNav(currentTab)` wired into the four pages. Must not hijack swipes inside
  horizontally scrollable elements (check `closest` for scrollable ancestors).

---

## Migrations (one file: `supabase/migrations/0008_social_v2.sql`, idempotent)

- `dm_messages`: add `client_id uuid unique`, allow kind `'sticker'`.
- `handles`: add `bio text`.
- `squad_invites` table.
- `battle_results` table.
- `match_queue` table.
- `students`: add `rating int default 1000`.
- (Optional) drop `challenge_votes` — or leave with a comment.
- RLS ON for all new tables, no policies (service-role only).

## Env

Add to `.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(Realtime subscribe only — anon key must have no table access via RLS).

## Deferred (append to `llm-wiki/deferred.md` with reasons)

1. **Real voice calls (WebRTC)** — big subsystem (signaling, TURN, permissions); build
   when squad retention is proven. The Realtime channels added now double as signaling
   transport later.
2. **ML/supervised matchmaking model** — needs data; `battle_results` is the training
   log. Revisit at ~1k battles.
3. **External GIF search (Giphy/Tenor)** — needs API key + content moderation; bundled
   sticker pack ships instead.

## Verification (each phase before commit)

- `npx tsc --noEmit` clean; `vitest run src/lib/social.test.ts` (+ new tests: rating
  formula, syllabus topic-picker, matchmaking pairing — pure functions, one small test
  file each).
- Manual on deployed app (two phones): chat is instant + no dupes; squad join reflects
  on both screens without reload; recipient can play after challenger finished; back
  from results → home; review → home card clears; ratings move after a battle;
  Play Online matches 2 players.

## Order & commits

Phase 0 (fixes) → 1 (Realtime) → 2 (social model) → 3 (syllabus) → 4 (review+memory)
→ 5 (rating/leaderboards) → 6 (Play Online) → 7 (polish). One commit per phase,
deploy after 0–1 (bug relief), again after 4, again after 7. Update `llm-wiki/index.md`
+ `log.md` at the end.
