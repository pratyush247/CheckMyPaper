# Deferred work & decisions — social slice (branch: feat/social-peer-connect)

Things we discussed this session but deliberately did **not** build, and why.
Each has an "add when" so it's a real backlog, not a graveyard.

## 1. Live two-way challenge voting
- **Discussed:** when two friends have no common weak topic, *both* players
  vote on a subject/topic and the app tallies the vote live.
- **Built instead:** the challenge **creator proposes** — picks a shared
  subject and types the exact topic; the model curates a JEE paper on it.
- **Why deferred:** a synchronous cross-device vote needs real-time state
  (polling both sides, tallying, a "waiting for your friend to vote" UI). It's
  a whole feature for the same end result (a paper on a mutually-relevant
  topic). Creator-proposes demos identically.
- **Add when:** the pilot shows friends argue over the topic, or want fairness
  in who picks.

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

## 4. "Common class" in the curated paper
- **Discussed:** the model should use the players' common **class** and
  competitive exam to curate the paper.
- **Built instead:** exam is fixed to **JEE Main** (already baked into
  `generateQuiz`); class is not used.
- **Why deferred:** the account only stores name + phone — class is captured
  nowhere. Adding it means new onboarding/profile fields.
- **Add when:** we add class/exam to the student profile (also needed for the
  NEET/CAT expansion in the PRD).

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
