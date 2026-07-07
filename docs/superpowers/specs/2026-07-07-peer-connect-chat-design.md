# Design: Peer Connections + Chat (Social slice B)

- **Date:** 2026-07-07
- **Status:** approved design, pre-implementation
- **Slice:** B of a 5-part social roadmap (A accounts, **B connections+chat**, C Gen-Z flavor, D live group competition, E camera proctoring). This spec covers **B only**.

## Goal
Let students connect with peers, chat 1:1, and challenge each other (and squads, up to 8) to async battles — building the social core the later slices hang off. Reuses existing Battle Mode + squads. Fun payoff (GIFs, slang autosuggest) is slice C.

## Locked constraints (from AGENTS.md + this session)
- **Supabase stays server-only.** The browser never talks to Supabase directly; all access is through `/api/*` (service-role). Chat freshness is achieved by **client polling**, not browser Realtime.
- **Local-first** remains the model for the learner's own data; social data (connections, messages, challenges) is inherently shared and lives server-side.
- Identity is the existing **trust-based phone key** (name + phone, no OTP). Verified accounts are slice A, deferred. This slice adds a claimed handle on top of the phone key; it does **not** add real auth.

## Decisions (from brainstorming)
| Question | Decision |
|---|---|
| Add-friend mechanism | **Both**: searchable `@handle` **and** personal invite code/link |
| Chat liveness | **Near-real-time via polling** (~2.5s while thread open); Supabase server-only preserved |
| Challenge | **Async**, reuses Battle 10-Q quiz; **1–8 players** (friend or squad); frozen question set; ranked result |
| Live simultaneous 8-player | **Deferred to slice D** |
| Safety | Block + report (minimal, routes to existing `/admin`) |

## Data model (new Supabase migration `0005_social`)
RLS enabled, no policies (service-role only), consistent with existing tables.

- **`handles`** — `phone (pk, fk students.phone)`, `handle (unique, citext/lowercased)`, `invite_code (unique, short random e.g. 6 chars)`, `created_at`. One handle per student, claimed once, immutable in this slice. `invite_code` is generated at claim time and is the value shared via link `/friends?add=<invite_code>`.
- **`friendships`** — `id`, `requester_phone`, `addressee_phone`, `status ('pending'|'accepted'|'blocked')`, `blocked_by (nullable phone)`, `created_at`, `updated_at`. Unique on the unordered pair (enforce a canonical `(low_phone, high_phone)` unique index so A↔B is one row). When `status='blocked'`, `blocked_by` records which side blocked.
- **`dm_threads`** — `id`, `a_phone`, `b_phone` (canonical ordered pair, unique), `created_at`, `last_message_at`. Created lazily on first message between accepted friends.
- **`dm_messages`** — `id`, `thread_id (fk)`, `sender_phone`, `body (text)`, `kind ('text'|'challenge'|'result'|'gif')` default `'text'`, `meta jsonb` (challenge/result payload; `gif` reserved for slice C), `created_at`.
- **`challenges`** — `id`, `topic`, `creator_phone`, `question_set jsonb` (the frozen 10 questions), `participant_phones text[]` (≤8), `status ('open'|'closed')`, `thread_id (nullable fk)`, `group_code (nullable)`, `created_at`, `expires_at`.
- **`challenge_scores`** — `challenge_id (fk)`, `phone`, `score int`, `time_ms int`, `played_at`. Unique `(challenge_id, phone)`.
- **`reports`** — `id`, `reporter_phone`, `target_phone`, `message_id (nullable)`, `reason`, `created_at`. Surfaced in existing `/admin`.

## API routes (`src/app/api/social/*`, all service-role, degrade to `{configured:false}` when Supabase env missing — matches existing pattern)
- `POST /handle` claim/get handle · `GET /handle?q=` search by handle prefix
- `GET /me?phone=` → my handle, invite code, pending requests count
- `POST /connect` `{by:'handle'|'code', value, phone, name}` → create friend request
- `POST /respond` `{friendshipId, action:'accept'|'decline'|'block'}`
- `GET /friends?phone=` → accepted connections (+ handles, last activity), pending in/out
- `GET /thread?phone&peer=` → resolve/create thread id (accepted friends only)
- `GET /messages?thread&since=` (poll) · `POST /messages` `{thread, sender, body}`
- `POST /challenge` `{creator, topic, participants[]|group_code}` → freezes question set (via existing quiz generation), posts a `challenge` message
- `GET /challenge?id=` → question set + participants + current scores
- `POST /challenge/score` `{challengeId, phone, score, timeMs}` → records, posts/updates `result` message when all played or on demand
- `POST /report` `{reporter, target, messageId?, reason}`

**Invite code:** the stored `handles.invite_code` (short random, unique), reusing the squad-code UX. Link form: `/friends?add=<invite_code>`.

## Challenge fairness
Question set is generated **once** at challenge creation (reusing the DeepSeek quiz path) and stored in `challenges.question_set`. Every participant plays that exact set through the existing battle runner (a "challenge" mode that loads a fixed set instead of generating). Result ranks by score, then `time_ms` as tiebreak.

## Client / UI
- **Entry point:** person icon in the **home TopBar** (beside the profile button); badge shows pending requests. No bottom-nav change.
- **`/friends`** — tabs/sections: Connections (chat), Requests (accept/decline), Challenges (active + results). "Add friend" (handle search or paste code) + your own code/link to share. First visit → claim handle.
- **`/friends/[handle]`** — DM thread: message list (polls `/messages?since=`), composer, and a **Challenge** action (pick topic → creates challenge → challenge card in thread → Play → result card). Block/report in a thread overflow menu.
- Reuses existing design tokens/components (`card`, `btn`, chat bubbles styled like the tutor chat). Reduced-motion-safe entrance animations already global.

## Safety
- **Block:** hides the thread, prevents new requests/messages both ways (`blocked_by` on friendship).
- **Report:** flags a message/user into `reports`, visible in token-gated `/admin`.
- Handle search returns only handle + display name, never phone numbers.

## Out of scope (this slice)
GIF sharing + slang-aware AI autosuggest (C) — `kind:'gif'` and `meta` are reserved so C is additive. Live simultaneous multiplayer + camera proctoring (D/E). Real accounts/OTP (A). Group *chat* rooms (only squad *challenges* here; 1:1 chat only).

## Testing
- Migration applies cleanly; canonical-pair unique constraints prevent duplicate friendships/threads.
- Unit: canonical pair ordering, invite-code derive/verify, challenge scoring/ranking + tiebreak, block gating.
- Flow (manual/e2e): claim handle → connect by handle → accept → chat polls new msg → challenge topic → both play frozen set → ranked result posts.
- Every route degrades gracefully when Supabase env is absent (`configured:false`), consistent with existing multiplayer.

## Rollout
One migration + new API namespace + new routes/components; no changes to existing learner flows. Ships behind the same "online play configured?" check already used by squads.
