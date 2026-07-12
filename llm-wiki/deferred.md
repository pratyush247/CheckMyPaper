# Deferred work & decisions — social slice (branch: feat/social-peer-connect)

Things we discussed this session but deliberately did **not** build, and why.
Each has an "add when" so it's a real backlog, not a graveyard.

## 1. Live two-way challenge voting — ✅ BUILT
- Both friends now see a **ballot card in the chat** (`challenge_votes` table,
  `/api/social/vote` + `/vote/cast`, `VoteCard`). Each casts one vote; when all
  have voted the winner resolves (majority; ties → first-listed option) and the
  challenge auto-creates via `createChallengeRecord`. Poll-based (2s), with an
  atomic status claim so the challenge is created once.
- **Still simplified:** tie-break is deterministic (first-listed), not a coin
  flip or run-off; vote is single-choice; resolution is poll-based, not push.
  Add real-time (Supabase Realtime) + run-off **when** the pilot needs it.

## 2. Username entry truly *inside* the top navbar
- **Discussed:** if the first-run username popup is skipped, the entry should
  live in the navbar.
- **Built instead:** a persistent floating **"Set @username"** pill
  (bottom-right), plus the global first-run modal.
- **Why deferred:** `TopBar` is composed per page with custom left/right slots
  (avatar, friends icon, back button). Injecting one global control into every
  page's navbar means editing every page. The floating pill is one component,
  visible everywhere, and never fights the per-page header.
- **Add when:** we standardise `TopBar` to render a shared global slot.

## 3. Self-hosted / fully offline font
- **Discussed:** `next/font/google` was hanging the dev server on a font fetch.
- **Built instead:** load Plus Jakarta Sans via a browser `<link>` (client-side,
  never blocks the server); system-stack fallback when offline.
- **Why deferred:** truly self-hosting needs the `.woff2` files committed to the
  repo; couldn't download them in the build sandbox (no network).
- **Add when:** we want zero external requests / guaranteed offline parity —
  download the woff2s into `public/fonts` and switch to `next/font/local`.

## 4. Class in the curated paper — ✅ BUILT
- Onboarding + profile now capture **class** (11/12/Dropper) and the student's
  self-reported **toughest subject**; stored on-device and mirrored to
  `students` (0007). `generateQuiz` takes `className` and pitches the paper to
  that level; challenges use the creator's class, battle uses the local class.
- **Simplified:** a challenge uses the **creator's** class, not a per-pair
  "common class" — friends who challenge are near-always the same class.
- **Still open:** exam is hard-coded to JEE (no NEET/CAT yet); `weakSubject` is
  stored but not yet acted on — it's the seed for the future teaching agent's
  per-student memory. Add when that agent is built.

## 5. Weak-topic re-sync cadence
- **Built:** the device pushes its weak topics to the server once, when
  `HandleGate` mounts with a handle.
- **Why lazy:** good enough for the pilot; a stale-by-one-paper topic list is
  harmless.
- **Add when:** topics feel out of date — call the sync after each finished
  paper too.

## 6. Verified production build
- **Status:** `tsc` + unit tests are green; `next build` was **not** run to
  completion in the sandbox (font-fetch hang, then a dead request layer at
  0% CPU — environment faults, not code).
- **Add when:** run `npm run build` locally before merge to confirm.

## Pre-existing advisories (still open, from earlier sessions)
- Real-phone voice test (Sarvam STT on a physical device).
- Top up OpenRouter / Sarvam credit; rotate the API keys.
- Finish Supabase MCP OAuth (needs an interactive restart).
- Run `/brandkit` for a fuller visual identity pass.

---

# v4.1 build (2026-07-12) — deferred with reasons

## 7. Real voice calls in squads (WebRTC)
- **Why deferred:** a full subsystem (signaling, TURN servers, mic permissions,
  call UX) — as big as several shipped features combined.
- **Head start already in place:** the Supabase Realtime channels added in this
  build double as the signaling transport later.
- **Add when:** squads show retention (friends actually battling weekly).

## 8. ML / supervised matchmaking model
- **Why deferred:** no training data yet. Every battle now logs a
  `battle_results` row (score, time, perf, rating) — that IS the dataset.
- **For now:** transparent Elo-lite (K=32, pairwise by perf) + rating-window
  matchmaking (±150, widening while waiting).
- **Add when:** ~1k battle_results rows exist.

## 9. Review tags → server-side rating
- **What's simplified:** perf's 20% "concept" slice defaults to accuracy
  server-side because review tags live on-device only.
- **Add when:** reviews sync to the server — then skipping the review really
  costs rating, as designed.

## 10. External GIF search (Giphy/Tenor)
- **Why deferred:** needs an API key + content moderation for minors.
- **Shipped instead:** a bundled emoji sticker pack in chat.

## 11. Live per-question progress ticker in online battles
- **Why deferred:** needs client→channel broadcasts mid-quiz; results already
  update live the second anyone finishes.
- **Add when:** online lobbies feel "dead" while waiting for others.
