# Peer Connections + Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let students claim a handle, connect with peers (by handle or invite code), chat 1:1, and challenge each other (and squads, up to 8) to async battles.

**Architecture:** Extend the existing server-only Supabase multiplayer. All DB access is through new `/api/social/*` routes (service-role); the browser never touches Supabase directly. Chat freshness via client polling (~2.5s). Pure logic (canonical pairs, invite codes, challenge ranking, block gating) lives in `src/lib/social.ts` and is unit-tested with Vitest; routes/UI are verified against the running dev app.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, TypeScript, Supabase (service-role), Vitest (new, for pure logic only).

## Global Constraints

- **Supabase is server-only.** Never import `@/lib/supabaseServer` or a Supabase client into client code. Browser → `/api/*` only.
- **Every route degrades** when Supabase env is missing: return `{ configured: false, ... }` (never throw). Copy the pattern from `src/app/api/group/route.ts`.
- **Phone normalization:** `String(x).replace(/\D/g, "")`, must be 10 digits. Reuse everywhere.
- **Identity is phone-based** (existing `students` table, `upsertStudent(phone, name)`); this slice adds handles, not real auth.
- **Invite/squad codes** use alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no ambiguous chars), length 6 — same as existing `genCode`.
- **Design tokens only** for UI: `card`, `btn`/`btn-primary`/`btn-ghost`/`btn-line`, `var(--color-*)`. Reduced-motion-safe animations are global already.
- **Commit** after every task with a `feat:`/`test:`/`chore:` message.

---

## File Structure

- Create `src/lib/social.ts` — pure logic: `canonicalPair`, `normalizeHandle`, `isValidHandle`, `genInviteCode`, `rankChallenge`, `blockState`. No I/O.
- Create `src/lib/social.test.ts` — Vitest unit tests for the above.
- Create `vitest.config.ts`, add `test` script — test runner setup.
- Create `supabase/migrations/0005_social.sql` — new tables.
- Create `src/app/api/social/handle/route.ts` — claim/get/search handle.
- Create `src/app/api/social/me/route.ts` — my handle + invite code + pending count.
- Create `src/app/api/social/connect/route.ts` — send friend request (by handle or code).
- Create `src/app/api/social/respond/route.ts` — accept/decline/block.
- Create `src/app/api/social/friends/route.ts` — list connections + requests.
- Create `src/app/api/social/messages/route.ts` — GET poll + POST send (resolves thread).
- Create `src/app/api/social/challenge/route.ts` — POST create, GET fetch.
- Create `src/app/api/social/challenge/score/route.ts` — POST record score.
- Create `src/app/api/social/report/route.ts` — POST report.
- Create `src/lib/socialClient.ts` — typed browser fetch helpers (mirrors `multiplayer.ts`).
- Create `src/app/friends/page.tsx` — hub: claim handle, add, requests, connections, challenges.
- Create `src/app/friends/[handle]/page.tsx` — DM thread + challenge action + block/report.
- Modify `src/app/page.tsx` — add Friends entry (person icon) in home top bar.
- Modify `llm-wiki/index.md` + `llm-wiki/log.md` — document the new routes/tables (final task).

---

### Task 1: Test setup + pure social logic (`src/lib/social.ts`)

**Files:**
- Create: `vitest.config.ts`, `src/lib/social.ts`, `src/lib/social.test.ts`
- Modify: `package.json` (add `test` script + devDeps)

**Interfaces:**
- Produces:
  - `canonicalPair(a: string, b: string): [string, string]` — the two phones sorted ascending (stable A↔B key).
  - `normalizeHandle(raw: string): string` — lowercased, trimmed, leading `@` stripped.
  - `isValidHandle(h: string): boolean` — 3–20 chars, `[a-z0-9_]`, must start with a letter.
  - `genInviteCode(): string` — 6 chars from the code alphabet.
  - `rankChallenge(scores: {phone: string; score: number; timeMs: number}[]): {phone: string; score: number; timeMs: number; rank: number; winner: boolean}[]` — sorted score desc then timeMs asc; `rank` 1-based; `winner` true only for a sole rank-1.
  - `blockState(f: {status: string; blocked_by: string|null}|null, me: string): 'none'|'blocked_by_me'|'blocked_me'` — block direction from a friendship row.

- [ ] **Step 1: Install Vitest**

Run: `npm i -D vitest`
Expected: added to devDependencies.

- [ ] **Step 2: Add config and test script**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", include: ["src/**/*.test.ts"] } });
```
In `package.json` `"scripts"`, add: `"test": "vitest run"`.

- [ ] **Step 3: Write the failing test**

Create `src/lib/social.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { canonicalPair, normalizeHandle, isValidHandle, genInviteCode, rankChallenge, blockState } from "./social";

describe("canonicalPair", () => {
  it("orders the same regardless of argument order", () => {
    expect(canonicalPair("9000000002", "9000000001")).toEqual(["9000000001", "9000000002"]);
    expect(canonicalPair("9000000001", "9000000002")).toEqual(["9000000001", "9000000002"]);
  });
});

describe("normalizeHandle / isValidHandle", () => {
  it("normalizes case and @", () => expect(normalizeHandle("  @Arjun_JEE ")).toBe("arjun_jee"));
  it("accepts valid handles", () => expect(isValidHandle("arjun_jee")).toBe(true));
  it("rejects too short, bad chars, leading digit", () => {
    expect(isValidHandle("ab")).toBe(false);
    expect(isValidHandle("bad handle")).toBe(false);
    expect(isValidHandle("1arjun")).toBe(false);
  });
});

describe("genInviteCode", () => {
  it("is 6 chars from the unambiguous alphabet", () => {
    const c = genInviteCode();
    expect(c).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });
});

describe("rankChallenge", () => {
  it("ranks by score desc then time asc, marks sole winner", () => {
    const r = rankChallenge([
      { phone: "a", score: 8, timeMs: 5000 },
      { phone: "b", score: 8, timeMs: 4000 },
      { phone: "c", score: 6, timeMs: 3000 },
    ]);
    expect(r.map((x) => x.phone)).toEqual(["b", "a", "c"]);
    expect(r[0]).toMatchObject({ rank: 1, winner: true });
    expect(r[1].rank).toBe(2);
  });
  it("no winner on a tie for first (same score+time)", () => {
    const r = rankChallenge([
      { phone: "a", score: 8, timeMs: 4000 },
      { phone: "b", score: 8, timeMs: 4000 },
    ]);
    expect(r[0].winner).toBe(false);
    expect(r[1].winner).toBe(false);
  });
});

describe("blockState", () => {
  it("reads block direction", () => {
    expect(blockState(null, "a")).toBe("none");
    expect(blockState({ status: "accepted", blocked_by: null }, "a")).toBe("none");
    expect(blockState({ status: "blocked", blocked_by: "a" }, "a")).toBe("blocked_by_me");
    expect(blockState({ status: "blocked", blocked_by: "b" }, "a")).toBe("blocked_me");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `./social` / functions not defined.

- [ ] **Step 5: Implement `src/lib/social.ts`**

```ts
// Pure social logic — no I/O, unit-tested. Shared by /api/social routes.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function canonicalPair(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

export function isValidHandle(h: string): boolean {
  return /^[a-z][a-z0-9_]{2,19}$/.test(h);
}

export function genInviteCode(): string {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");
}

export interface ChallengeScore { phone: string; score: number; timeMs: number }
export interface RankedScore extends ChallengeScore { rank: number; winner: boolean }

export function rankChallenge(scores: ChallengeScore[]): RankedScore[] {
  const sorted = [...scores].sort((x, y) => y.score - x.score || x.timeMs - y.timeMs);
  const ranked = sorted.map((s, i) => ({ ...s, rank: i + 1, winner: false }));
  if (ranked.length > 0) {
    const top = ranked[0];
    const tiedTop = ranked.filter((r) => r.score === top.score && r.timeMs === top.timeMs);
    if (tiedTop.length === 1) ranked[0].winner = true;
  }
  return ranked;
}

export function blockState(
  f: { status: string; blocked_by: string | null } | null,
  me: string,
): "none" | "blocked_by_me" | "blocked_me" {
  if (!f || f.status !== "blocked") return "none";
  return f.blocked_by === me ? "blocked_by_me" : "blocked_me";
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all suites green).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/social.ts src/lib/social.test.ts
git commit -m "test: add vitest + pure social logic (pairs, handles, invite codes, ranking, block)"
```

---

### Task 2: Migration `0005_social.sql`

**Files:**
- Create: `supabase/migrations/0005_social.sql`

**Interfaces:**
- Produces tables: `handles`, `friendships`, `dm_threads`, `dm_messages`, `challenges`, `challenge_scores`, `reports` (columns per spec).

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0005_social.sql`:
```sql
-- Social slice B: handles, friendships, DM threads/messages, challenges, reports.
-- RLS enabled with no policies (service-role only), matching existing tables.

create table if not exists handles (
  phone text primary key references students(phone) on delete cascade,
  handle text unique not null,
  invite_code text unique not null,
  created_at timestamptz not null default now()
);
create index if not exists handles_handle_idx on handles (lower(handle));

create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  requester_phone text not null references students(phone) on delete cascade,
  addressee_phone text not null references students(phone) on delete cascade,
  low_phone text not null,
  high_phone text not null,
  status text not null default 'pending' check (status in ('pending','accepted','blocked')),
  blocked_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (low_phone, high_phone)
);

create table if not exists dm_threads (
  id uuid primary key default gen_random_uuid(),
  a_phone text not null,
  b_phone text not null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  unique (a_phone, b_phone)
);

create table if not exists dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references dm_threads(id) on delete cascade,
  sender_phone text not null,
  body text not null default '',
  kind text not null default 'text' check (kind in ('text','challenge','result','gif')),
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists dm_messages_thread_idx on dm_messages (thread_id, created_at);

create table if not exists challenges (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  creator_phone text not null,
  question_set jsonb not null,
  participant_phones text[] not null,
  status text not null default 'open' check (status in ('open','closed')),
  thread_id uuid references dm_threads(id) on delete set null,
  group_code text,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists challenge_scores (
  challenge_id uuid not null references challenges(id) on delete cascade,
  phone text not null,
  score int not null,
  time_ms int not null,
  played_at timestamptz not null default now(),
  primary key (challenge_id, phone)
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_phone text not null,
  target_phone text not null,
  message_id uuid,
  reason text not null default '',
  created_at timestamptz not null default now()
);

alter table handles enable row level security;
alter table friendships enable row level security;
alter table dm_threads enable row level security;
alter table dm_messages enable row level security;
alter table challenges enable row level security;
alter table challenge_scores enable row level security;
alter table reports enable row level security;
```

- [ ] **Step 2: Apply the migration**

Apply via the project's Supabase (SQL editor or `supabase db push` if CLI is linked). If no Supabase access in this environment, the migration file IS the deliverable; routes already degrade to `configured:false` so later tasks remain testable without it.
Expected: tables exist; `select count(*) from handles;` returns 0 rows without error.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0005_social.sql
git commit -m "feat: 0005_social migration (handles, friendships, dm, challenges, reports)"
```

---

### Task 3: Handle API (`/api/social/handle`, `/api/social/me`)

**Files:**
- Create: `src/app/api/social/handle/route.ts`, `src/app/api/social/me/route.ts`

**Interfaces:**
- Consumes: `normalizeHandle`, `isValidHandle`, `genInviteCode` (Task 1); `supabase`, `supabaseConfigured`, `upsertStudent` (existing).
- Produces (HTTP contracts):
  - `POST /api/social/handle` `{phone,name,handle}` → `{ok:true, handle, inviteCode}` | `{ok:false, error}` (409 on taken).
  - `GET /api/social/handle?q=<prefix>&me=<phone>` → `{configured, results: {handle, name, phone}[]}` (excludes `me`, max 10).
  - `GET /api/social/me?phone=` → `{configured, handle: string|null, inviteCode: string|null, pending: number}`.

- [ ] **Step 1: Implement `handle/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured, upsertStudent } from "@/lib/supabaseServer";
import { normalizeHandle, isValidHandle, genInviteCode } from "@/lib/social";

export const maxDuration = 30;

// GET /api/social/handle?q=&me=  → search handles by prefix
export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ configured: false, results: [] });
  const url = new URL(req.url);
  const q = normalizeHandle(url.searchParams.get("q") || "");
  const me = (url.searchParams.get("me") || "").replace(/\D/g, "");
  if (q.length < 2) return NextResponse.json({ configured: true, results: [] });
  try {
    const { data } = await supabase()
      .from("handles")
      .select("handle, phone, students(name)")
      .ilike("handle", `${q}%`)
      .limit(11);
    const results = (data ?? [])
      .filter((r) => r.phone !== me)
      .slice(0, 10)
      .map((r) => {
        const s = Array.isArray(r.students) ? r.students[0] : r.students;
        return { handle: r.handle as string, phone: r.phone as string, name: (s as { name: string } | null)?.name ?? "" };
      });
    return NextResponse.json({ configured: true, results });
  } catch (err) {
    console.error("handle search error", err);
    return NextResponse.json({ configured: true, results: [], error: "search failed" }, { status: 500 });
  }
}

// POST { phone, name, handle } → claim a handle (once)
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, configured: false });
  try {
    const b = await req.json();
    const phone = String(b.phone || "").replace(/\D/g, "");
    const name = String(b.name || "").trim();
    const handle = normalizeHandle(String(b.handle || ""));
    if (phone.length !== 10 || !name) return NextResponse.json({ ok: false, error: "bad input" }, { status: 400 });
    if (!isValidHandle(handle)) return NextResponse.json({ ok: false, error: "Handle must be 3–20 chars, start with a letter, use a–z 0–9 _" }, { status: 400 });
    await upsertStudent(phone, name);

    const existing = await supabase().from("handles").select("handle, invite_code").eq("phone", phone).maybeSingle();
    if (existing.data) return NextResponse.json({ ok: true, handle: existing.data.handle, inviteCode: existing.data.invite_code, already: true });

    for (let i = 0; i < 5; i++) {
      const invite_code = genInviteCode();
      const { error } = await supabase().from("handles").insert({ phone, handle, invite_code });
      if (!error) return NextResponse.json({ ok: true, handle, inviteCode: invite_code });
      if (error.code === "23505" && String(error.message).includes("handle")) return NextResponse.json({ ok: false, error: "That handle is taken" }, { status: 409 });
      // else invite_code collision → retry
    }
    return NextResponse.json({ ok: false, error: "Could not claim, try again" }, { status: 500 });
  } catch (err) {
    console.error("handle claim error", err);
    return NextResponse.json({ ok: false, error: "claim failed" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Implement `me/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/lib/supabaseServer";

export const maxDuration = 30;

// GET /api/social/me?phone=  → my handle, invite code, pending request count
export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ configured: false, handle: null, inviteCode: null, pending: 0 });
  const phone = (new URL(req.url).searchParams.get("phone") || "").replace(/\D/g, "");
  if (phone.length !== 10) return NextResponse.json({ configured: true, handle: null, inviteCode: null, pending: 0 });
  try {
    const h = await supabase().from("handles").select("handle, invite_code").eq("phone", phone).maybeSingle();
    const { count } = await supabase()
      .from("friendships")
      .select("id", { count: "exact", head: true })
      .eq("addressee_phone", phone)
      .eq("status", "pending");
    return NextResponse.json({
      configured: true,
      handle: h.data?.handle ?? null,
      inviteCode: h.data?.invite_code ?? null,
      pending: count ?? 0,
    });
  } catch (err) {
    console.error("social me error", err);
    return NextResponse.json({ configured: true, handle: null, inviteCode: null, pending: 0, error: "failed" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify against the running app**

Start dev if needed (`npm run dev`). With Supabase configured:
```bash
curl -s -XPOST localhost:3000/api/social/handle -H 'content-type: application/json' -d '{"phone":"9000000001","name":"Arjun","handle":"arjun_jee"}'
# → {"ok":true,"handle":"arjun_jee","inviteCode":"XXXXXX"}
curl -s "localhost:3000/api/social/handle?q=arj&me=9000000002"   # → results incl arjun_jee
curl -s "localhost:3000/api/social/me?phone=9000000001"          # → handle+inviteCode, pending:0
```
Without Supabase env: each returns `configured:false` and does not throw.
Expected: matches contracts above.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/social/handle/route.ts src/app/api/social/me/route.ts
git commit -m "feat: social handle claim/search + me endpoint"
```

---

### Task 4: Connect + friends API (`/connect`, `/respond`, `/friends`)

**Files:**
- Create: `src/app/api/social/connect/route.ts`, `src/app/api/social/respond/route.ts`, `src/app/api/social/friends/route.ts`

**Interfaces:**
- Consumes: `canonicalPair`, `normalizeHandle` (Task 1); existing supabase helpers.
- Produces:
  - `POST /connect` `{phone,name,by:'handle'|'code',value}` → `{ok, status:'pending'|'accepted', error?}`. Resolves target phone from `handles` (by handle or invite_code), creates/uses the canonical friendship row. If a reverse pending request exists, accept it.
  - `POST /respond` `{phone, friendshipId, action:'accept'|'decline'|'block'}` → `{ok}`.
  - `GET /friends?phone=` → `{configured, friends: {phone,handle,name,lastMessageAt}[], incoming: {id,phone,handle,name}[], outgoing:{id,handle,name}[]}`.

- [ ] **Step 1: Implement `connect/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured, upsertStudent } from "@/lib/supabaseServer";
import { canonicalPair, normalizeHandle } from "@/lib/social";

export const maxDuration = 30;

// POST { phone, name, by:'handle'|'code', value }
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, configured: false });
  try {
    const b = await req.json();
    const me = String(b.phone || "").replace(/\D/g, "");
    const name = String(b.name || "").trim();
    if (me.length !== 10 || !name) return NextResponse.json({ ok: false, error: "bad input" }, { status: 400 });
    await upsertStudent(me, name);

    const by = b.by === "code" ? "code" : "handle";
    const q = by === "code" ? String(b.value || "").trim().toUpperCase() : normalizeHandle(String(b.value || ""));
    const target = await supabase()
      .from("handles")
      .select("phone")
      .eq(by === "code" ? "invite_code" : "handle", q)
      .maybeSingle();
    const other = target.data?.phone as string | undefined;
    if (!other) return NextResponse.json({ ok: false, error: "No one found for that" }, { status: 404 });
    if (other === me) return NextResponse.json({ ok: false, error: "That's you 🙂" }, { status: 400 });

    const [low, high] = canonicalPair(me, other);
    const existing = await supabase().from("friendships").select("id,status,requester_phone,blocked_by").eq("low_phone", low).eq("high_phone", high).maybeSingle();

    if (existing.data) {
      const f = existing.data;
      if (f.status === "blocked") return NextResponse.json({ ok: false, error: "Unavailable" }, { status: 403 });
      if (f.status === "accepted") return NextResponse.json({ ok: true, status: "accepted" });
      // pending: if the other person requested me, accept it
      if (f.requester_phone === other) {
        await supabase().from("friendships").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", f.id);
        return NextResponse.json({ ok: true, status: "accepted" });
      }
      return NextResponse.json({ ok: true, status: "pending" }); // my own pending already exists
    }

    await supabase().from("friendships").insert({
      requester_phone: me, addressee_phone: other, low_phone: low, high_phone: high, status: "pending",
    });
    return NextResponse.json({ ok: true, status: "pending" });
  } catch (err) {
    console.error("connect error", err);
    return NextResponse.json({ ok: false, error: "connect failed" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Implement `respond/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/lib/supabaseServer";

export const maxDuration = 30;

// POST { phone, friendshipId, action:'accept'|'decline'|'block' }
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, configured: false });
  try {
    const b = await req.json();
    const me = String(b.phone || "").replace(/\D/g, "");
    const id = String(b.friendshipId || "");
    const action = b.action;
    if (me.length !== 10 || !id) return NextResponse.json({ ok: false, error: "bad input" }, { status: 400 });

    const row = await supabase().from("friendships").select("id,requester_phone,addressee_phone").eq("id", id).maybeSingle();
    if (!row.data) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    if (me !== row.data.requester_phone && me !== row.data.addressee_phone) return NextResponse.json({ ok: false, error: "not yours" }, { status: 403 });

    if (action === "accept") {
      await supabase().from("friendships").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", id);
    } else if (action === "block") {
      await supabase().from("friendships").update({ status: "blocked", blocked_by: me, updated_at: new Date().toISOString() }).eq("id", id);
    } else {
      await supabase().from("friendships").delete().eq("id", id); // decline
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("respond error", err);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Implement `friends/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/lib/supabaseServer";

export const maxDuration = 30;

type Row = { id: string; requester_phone: string; addressee_phone: string; status: string };

// GET /api/social/friends?phone=
export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ configured: false, friends: [], incoming: [], outgoing: [] });
  const me = (new URL(req.url).searchParams.get("phone") || "").replace(/\D/g, "");
  if (me.length !== 10) return NextResponse.json({ configured: true, friends: [], incoming: [], outgoing: [] });
  try {
    const { data } = await supabase()
      .from("friendships")
      .select("id,requester_phone,addressee_phone,status")
      .or(`requester_phone.eq.${me},addressee_phone.eq.${me}`);
    const rows = (data ?? []) as Row[];
    const others = rows.map((r) => (r.requester_phone === me ? r.addressee_phone : r.requester_phone));
    // resolve handles + names in one query
    const { data: hs } = await supabase().from("handles").select("phone, handle, students(name)").in("phone", others.length ? others : ["_"]);
    const info = new Map<string, { handle: string; name: string }>();
    for (const h of hs ?? []) {
      const s = Array.isArray(h.students) ? h.students[0] : h.students;
      info.set(h.phone as string, { handle: h.handle as string, name: (s as { name: string } | null)?.name ?? "" });
    }
    const pick = (p: string) => ({ phone: p, handle: info.get(p)?.handle ?? "", name: info.get(p)?.name ?? "" });

    const friends = rows.filter((r) => r.status === "accepted").map((r) => pick(r.requester_phone === me ? r.addressee_phone : r.requester_phone));
    const incoming = rows.filter((r) => r.status === "pending" && r.addressee_phone === me).map((r) => ({ id: r.id, ...pick(r.requester_phone) }));
    const outgoing = rows.filter((r) => r.status === "pending" && r.requester_phone === me).map((r) => ({ id: r.id, ...pick(r.addressee_phone) }));
    return NextResponse.json({ configured: true, friends, incoming, outgoing });
  } catch (err) {
    console.error("friends list error", err);
    return NextResponse.json({ configured: true, friends: [], incoming: [], outgoing: [], error: "failed" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Verify**

```bash
# claim a second handle first
curl -s -XPOST localhost:3000/api/social/handle -H 'content-type: application/json' -d '{"phone":"9000000002","name":"Bina","handle":"bina_x"}'
# connect me(1)->bina by handle
curl -s -XPOST localhost:3000/api/social/connect -H 'content-type: application/json' -d '{"phone":"9000000001","name":"Arjun","by":"handle","value":"bina_x"}'   # {"ok":true,"status":"pending"}
curl -s "localhost:3000/api/social/friends?phone=9000000002"   # incoming has arjun with an id
# accept it (use that id)
curl -s -XPOST localhost:3000/api/social/respond -H 'content-type: application/json' -d '{"phone":"9000000002","friendshipId":"<id>","action":"accept"}'
curl -s "localhost:3000/api/social/friends?phone=9000000001"   # friends includes bina_x
```
Expected: request → accept → both list each other as friends.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/social/connect/route.ts src/app/api/social/respond/route.ts src/app/api/social/friends/route.ts
git commit -m "feat: social connect/respond/friends (requests, accept, block, decline)"
```

---

### Task 5: Chat API (`/api/social/messages`)

**Files:**
- Create: `src/app/api/social/messages/route.ts`

**Interfaces:**
- Consumes: `canonicalPair`, `blockState` (Task 1).
- Produces:
  - Helper `resolveThread(me, peer)` (inline) → thread id for two **accepted** friends (creates lazily); returns `null` if not accepted or blocked.
  - `GET /api/social/messages?phone=&peer=&since=` → `{configured, threadId, messages: {id,sender,body,kind,meta,createdAt}[]}` (messages after `since` ISO, max 100).
  - `POST /api/social/messages` `{phone,name,peer,body}` → `{ok, message}`. Rejects if blocked.

- [ ] **Step 1: Implement `messages/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured, upsertStudent } from "@/lib/supabaseServer";
import { canonicalPair, blockState } from "@/lib/social";

export const maxDuration = 30;

async function friendship(me: string, peer: string) {
  const [low, high] = canonicalPair(me, peer);
  const { data } = await supabase().from("friendships").select("status,blocked_by").eq("low_phone", low).eq("high_phone", high).maybeSingle();
  return data as { status: string; blocked_by: string | null } | null;
}

async function resolveThread(me: string, peer: string): Promise<string | null> {
  const f = await friendship(me, peer);
  if (!f || f.status !== "accepted") return null;
  const [a, b] = canonicalPair(me, peer);
  const existing = await supabase().from("dm_threads").select("id").eq("a_phone", a).eq("b_phone", b).maybeSingle();
  if (existing.data) return existing.data.id as string;
  const created = await supabase().from("dm_threads").insert({ a_phone: a, b_phone: b }).select("id").single();
  return (created.data?.id as string) ?? null;
}

function mapMsg(m: Record<string, unknown>) {
  return { id: m.id, sender: m.sender_phone, body: m.body, kind: m.kind, meta: m.meta ?? null, createdAt: m.created_at };
}

// GET ?phone=&peer=&since=
export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ configured: false, threadId: null, messages: [] });
  const url = new URL(req.url);
  const me = (url.searchParams.get("phone") || "").replace(/\D/g, "");
  const peer = (url.searchParams.get("peer") || "").replace(/\D/g, "");
  const since = url.searchParams.get("since");
  if (me.length !== 10 || peer.length !== 10) return NextResponse.json({ configured: true, threadId: null, messages: [] });
  try {
    const threadId = await resolveThread(me, peer);
    if (!threadId) return NextResponse.json({ configured: true, threadId: null, messages: [] });
    let query = supabase().from("dm_messages").select("*").eq("thread_id", threadId).order("created_at", { ascending: true }).limit(100);
    if (since) query = query.gt("created_at", since);
    const { data } = await query;
    return NextResponse.json({ configured: true, threadId, messages: (data ?? []).map(mapMsg) });
  } catch (err) {
    console.error("messages get error", err);
    return NextResponse.json({ configured: true, threadId: null, messages: [], error: "failed" }, { status: 500 });
  }
}

// POST { phone, name, peer, body }
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, configured: false });
  try {
    const b = await req.json();
    const me = String(b.phone || "").replace(/\D/g, "");
    const name = String(b.name || "").trim();
    const peer = String(b.peer || "").replace(/\D/g, "");
    const body = String(b.body || "").trim();
    if (me.length !== 10 || peer.length !== 10 || !body) return NextResponse.json({ ok: false, error: "bad input" }, { status: 400 });
    if (body.length > 2000) return NextResponse.json({ ok: false, error: "too long" }, { status: 400 });
    if (name) await upsertStudent(me, name);

    const f = await friendship(me, peer);
    if (blockState(f, me) !== "none") return NextResponse.json({ ok: false, error: "unavailable" }, { status: 403 });
    const threadId = await resolveThread(me, peer);
    if (!threadId) return NextResponse.json({ ok: false, error: "not connected" }, { status: 403 });

    const ins = await supabase().from("dm_messages").insert({ thread_id: threadId, sender_phone: me, body, kind: "text" }).select("*").single();
    await supabase().from("dm_threads").update({ last_message_at: new Date().toISOString() }).eq("id", threadId);
    return NextResponse.json({ ok: true, message: mapMsg(ins.data as Record<string, unknown>) });
  } catch (err) {
    console.error("messages post error", err);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify (friends 1 & 2 from Task 4 must be accepted)**

```bash
curl -s -XPOST localhost:3000/api/social/messages -H 'content-type: application/json' -d '{"phone":"9000000001","name":"Arjun","peer":"9000000002","body":"yo bina"}'
curl -s "localhost:3000/api/social/messages?phone=9000000002&peer=9000000001"   # sees "yo bina"
# non-friend send is rejected 403
```
Expected: message stored + visible to peer; non-accepted pairs get `not connected`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/social/messages/route.ts
git commit -m "feat: social 1:1 chat messages (poll GET + send POST, block-gated)"
```

---

### Task 6: Challenge API (`/challenge`, `/challenge/score`)

**Files:**
- Create: `src/app/api/social/challenge/route.ts`, `src/app/api/social/challenge/score/route.ts`
- Reference: `src/lib/ai.ts` `generateQuiz` (existing quiz generator — inspect its exact signature/return before calling; it powers Battle Mode).

**Interfaces:**
- Consumes: `rankChallenge` (Task 1); existing quiz generation from `ai.ts`.
- Produces:
  - `POST /challenge` `{phone,name,topic,participants?:string[],groupCode?,threadId?}` → `{ok, challengeId, questions}`. Freezes a 10-question set into `challenges.question_set`. Posts a `kind:'challenge'` message into the thread when `threadId` present.
  - `GET /challenge?id=` → `{topic, questions, participants, scores: RankedScore[], status}`.
  - `POST /challenge/score` `{challengeId, phone, score, timeMs}` → `{ok, ranked: RankedScore[]}`; upserts, and when every participant has a score, sets `status:'closed'` and posts a `kind:'result'` message.

- [ ] **Step 1: Inspect the existing quiz generator**

Read `src/lib/ai.ts` for the quiz function (Battle Mode uses it). Note its exact name, input (topic) and the question object shape it returns. Use that exact shape for `question_set`. (Do not invent a new question format.)

- [ ] **Step 2: Implement `challenge/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured, upsertStudent } from "@/lib/supabaseServer";
import { rankChallenge } from "@/lib/social";
import { generateQuiz } from "@/lib/ai"; // adjust import to the actual exported name found in Step 1

export const maxDuration = 120;

// POST { phone, name, topic, participants?, groupCode?, threadId? }
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, configured: false });
  try {
    const b = await req.json();
    const me = String(b.phone || "").replace(/\D/g, "");
    const name = String(b.name || "").trim();
    const topic = String(b.topic || "").trim();
    if (me.length !== 10 || !topic) return NextResponse.json({ ok: false, error: "bad input" }, { status: 400 });
    if (name) await upsertStudent(me, name);

    let participants: string[] = Array.isArray(b.participants) ? b.participants.map((p: string) => String(p).replace(/\D/g, "")) : [];
    if (b.groupCode) {
      const { data } = await supabase().from("group_members").select("phone").eq("group_code", String(b.groupCode));
      participants = (data ?? []).map((m) => m.phone as string);
    }
    participants = Array.from(new Set([me, ...participants])).slice(0, 8);

    const questions = await generateQuiz(topic); // exact call from Step 1; returns the 10-question array
    const ins = await supabase().from("challenges").insert({
      topic, creator_phone: me, question_set: questions, participant_phones: participants,
      status: "open", thread_id: b.threadId ?? null, group_code: b.groupCode ?? null,
      expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
    }).select("id").single();
    const challengeId = ins.data?.id as string;

    if (b.threadId) {
      await supabase().from("dm_messages").insert({
        thread_id: b.threadId, sender_phone: me, kind: "challenge", body: `Challenge: ${topic}`,
        meta: { challengeId, topic },
      });
    }
    return NextResponse.json({ ok: true, challengeId, questions });
  } catch (err) {
    console.error("challenge create error", err);
    return NextResponse.json({ ok: false, error: "create failed" }, { status: 500 });
  }
}

// GET ?id=
export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ configured: false });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ configured: true, error: "no id" }, { status: 400 });
  try {
    const c = await supabase().from("challenges").select("*").eq("id", id).maybeSingle();
    if (!c.data) return NextResponse.json({ configured: true, error: "not found" }, { status: 404 });
    const { data: sc } = await supabase().from("challenge_scores").select("phone,score,time_ms").eq("challenge_id", id);
    const ranked = rankChallenge((sc ?? []).map((s) => ({ phone: s.phone as string, score: s.score as number, timeMs: s.time_ms as number })));
    return NextResponse.json({
      configured: true, topic: c.data.topic, questions: c.data.question_set,
      participants: c.data.participant_phones, status: c.data.status, scores: ranked,
    });
  } catch (err) {
    console.error("challenge get error", err);
    return NextResponse.json({ configured: true, error: "failed" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Implement `challenge/score/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/lib/supabaseServer";
import { rankChallenge } from "@/lib/social";

export const maxDuration = 30;

// POST { challengeId, phone, score, timeMs }
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, configured: false });
  try {
    const b = await req.json();
    const challengeId = String(b.challengeId || "");
    const phone = String(b.phone || "").replace(/\D/g, "");
    const score = Number(b.score);
    const timeMs = Number(b.timeMs);
    if (!challengeId || phone.length !== 10 || Number.isNaN(score) || Number.isNaN(timeMs)) return NextResponse.json({ ok: false, error: "bad input" }, { status: 400 });

    await supabase().from("challenge_scores").upsert({ challenge_id: challengeId, phone, score, time_ms: timeMs }, { onConflict: "challenge_id,phone" });

    const c = await supabase().from("challenges").select("participant_phones,thread_id,topic,status").eq("id", challengeId).maybeSingle();
    const { data: sc } = await supabase().from("challenge_scores").select("phone,score,time_ms").eq("challenge_id", challengeId);
    const ranked = rankChallenge((sc ?? []).map((s) => ({ phone: s.phone as string, score: s.score as number, timeMs: s.time_ms as number })));

    const participants: string[] = c.data?.participant_phones ?? [];
    const allPlayed = participants.length > 0 && participants.every((p) => ranked.some((r) => r.phone === p));
    if (allPlayed && c.data?.status !== "closed") {
      await supabase().from("challenges").update({ status: "closed" }).eq("id", challengeId);
      if (c.data?.thread_id) {
        await supabase().from("dm_messages").insert({
          thread_id: c.data.thread_id, sender_phone: phone, kind: "result", body: `Result: ${c.data.topic}`,
          meta: { challengeId, ranked },
        });
      }
    }
    return NextResponse.json({ ok: true, ranked, closed: allPlayed });
  } catch (err) {
    console.error("challenge score error", err);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Verify**

```bash
CID=$(curl -s -XPOST localhost:3000/api/social/challenge -H 'content-type: application/json' -d '{"phone":"9000000001","name":"Arjun","topic":"Rotational Motion","participants":["9000000002"]}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["challengeId"])')
curl -s "localhost:3000/api/social/challenge?id=$CID" | head -c 200   # topic+questions+participants
curl -s -XPOST localhost:3000/api/social/challenge/score -H 'content-type: application/json' -d "{\"challengeId\":\"$CID\",\"phone\":\"9000000001\",\"score\":8,\"timeMs\":41000}"
curl -s -XPOST localhost:3000/api/social/challenge/score -H 'content-type: application/json' -d "{\"challengeId\":\"$CID\",\"phone\":\"9000000002\",\"score\":6,\"timeMs\":39000}"   # closed:true, ranked with winner
```
Expected: challenge stores 10 questions; second score closes it and ranks (Arjun winner, 8>6).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/social/challenge/route.ts src/app/api/social/challenge/score/route.ts
git commit -m "feat: async challenges (frozen question set, up to 8 players, ranked results)"
```

---

### Task 7: Report API + block gating check

**Files:**
- Create: `src/app/api/social/report/route.ts`

**Interfaces:**
- Produces: `POST /report` `{reporter,target,messageId?,reason}` → `{ok}`.
- Block gating is already enforced in Task 5 (messages) and Task 4 (connect returns 403 on blocked). This task adds reporting.

- [ ] **Step 1: Implement `report/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/lib/supabaseServer";

export const maxDuration = 30;

// POST { reporter, target, messageId?, reason }
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, configured: false });
  try {
    const b = await req.json();
    const reporter = String(b.reporter || "").replace(/\D/g, "");
    const target = String(b.target || "").replace(/\D/g, "");
    if (reporter.length !== 10 || target.length !== 10) return NextResponse.json({ ok: false, error: "bad input" }, { status: 400 });
    await supabase().from("reports").insert({
      reporter_phone: reporter, target_phone: target,
      message_id: b.messageId ? String(b.messageId) : null, reason: String(b.reason || "").slice(0, 500),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("report error", err);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify**

```bash
curl -s -XPOST localhost:3000/api/social/report -H 'content-type: application/json' -d '{"reporter":"9000000002","target":"9000000001","reason":"spam"}'   # {"ok":true}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/social/report/route.ts
git commit -m "feat: social report endpoint"
```

---

### Task 8: Browser client lib (`src/lib/socialClient.ts`)

**Files:**
- Create: `src/lib/socialClient.ts` (mirrors the style of `src/lib/multiplayer.ts` — plain fetch wrappers, typed).

**Interfaces:**
- Produces typed helpers used by the UI tasks:
  - `getMe(phone)`, `claimHandle(phone,name,handle)`, `searchHandles(q,me)`
  - `connect(phone,name,by,value)`, `respond(phone,friendshipId,action)`, `getFriends(phone)`
  - `getMessages(phone,peer,since?)`, `sendMessage(phone,name,peer,body)`
  - `createChallenge(phone,name,topic,opts)`, `getChallenge(id)`, `submitChallengeScore(challengeId,phone,score,timeMs)`
  - `report(reporter,target,opts)`
  - Types: `Handle`, `FriendInfo`, `PendingReq`, `ChatMessage`, `ChallengeView`, `RankedScore` (re-export from `social.ts`).

- [ ] **Step 1: Implement `socialClient.ts`**

```ts
"use client";
import type { RankedScore } from "@/lib/social";
export type { RankedScore };

export interface FriendInfo { phone: string; handle: string; name: string }
export interface PendingReq { id: string; phone: string; handle: string; name: string }
export interface ChatMessage { id: string; sender: string; body: string; kind: "text" | "challenge" | "result" | "gif"; meta: unknown; createdAt: string }
export interface ChallengeView { topic: string; questions: unknown[]; participants: string[]; status: string; scores: RankedScore[] }

const j = (r: Response) => r.json();
const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(j);

export const getMe = (phone: string) => fetch(`/api/social/me?phone=${phone}`).then(j) as Promise<{ configured: boolean; handle: string | null; inviteCode: string | null; pending: number }>;
export const claimHandle = (phone: string, name: string, handle: string) => post("/api/social/handle", { phone, name, handle }) as Promise<{ ok: boolean; handle?: string; inviteCode?: string; error?: string }>;
export const searchHandles = (q: string, me: string) => fetch(`/api/social/handle?q=${encodeURIComponent(q)}&me=${me}`).then(j) as Promise<{ results: { handle: string; phone: string; name: string }[] }>;

export const connect = (phone: string, name: string, by: "handle" | "code", value: string) => post("/api/social/connect", { phone, name, by, value }) as Promise<{ ok: boolean; status?: string; error?: string }>;
export const respond = (phone: string, friendshipId: string, action: "accept" | "decline" | "block") => post("/api/social/respond", { phone, friendshipId, action }) as Promise<{ ok: boolean }>;
export const getFriends = (phone: string) => fetch(`/api/social/friends?phone=${phone}`).then(j) as Promise<{ configured: boolean; friends: FriendInfo[]; incoming: PendingReq[]; outgoing: PendingReq[] }>;

export const getMessages = (phone: string, peer: string, since?: string) => fetch(`/api/social/messages?phone=${phone}&peer=${peer}${since ? `&since=${encodeURIComponent(since)}` : ""}`).then(j) as Promise<{ threadId: string | null; messages: ChatMessage[] }>;
export const sendMessage = (phone: string, name: string, peer: string, body: string) => post("/api/social/messages", { phone, name, peer, body }) as Promise<{ ok: boolean; message?: ChatMessage; error?: string }>;

export const createChallenge = (phone: string, name: string, topic: string, opts: { participants?: string[]; groupCode?: string; threadId?: string }) => post("/api/social/challenge", { phone, name, topic, ...opts }) as Promise<{ ok: boolean; challengeId?: string; questions?: unknown[]; error?: string }>;
export const getChallenge = (id: string) => fetch(`/api/social/challenge?id=${id}`).then(j) as Promise<ChallengeView & { configured: boolean }>;
export const submitChallengeScore = (challengeId: string, phone: string, score: number, timeMs: number) => post("/api/social/challenge/score", { challengeId, phone, score, timeMs }) as Promise<{ ok: boolean; ranked: RankedScore[]; closed: boolean }>;

export const report = (reporter: string, target: string, opts: { messageId?: string; reason?: string }) => post("/api/social/report", { reporter, target, ...opts }) as Promise<{ ok: boolean }>;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/socialClient.ts
git commit -m "feat: socialClient fetch helpers"
```

---

### Task 9: Friends hub page + home entry

**Files:**
- Create: `src/app/friends/page.tsx`
- Modify: `src/app/page.tsx` (add a person icon linking to `/friends` in the home top bar, near the profile button)

**Interfaces:**
- Consumes: `socialClient` helpers (Task 8); existing `useMounted`/account from `@/lib/useStore` (inspect how `profile/page.tsx` reads the current account's `phone`/`name` and reuse that exact accessor).

- [ ] **Step 1: Find the current-account accessor**

Read `src/app/profile/page.tsx` (or `src/lib/store.ts`) for how the logged-in `{name, phone}` is read on the client. Use that same accessor in the new pages (do not invent a new one).

- [ ] **Step 2: Implement `friends/page.tsx`**

Full component: claim-handle gate (if `getMe().handle` is null, show a claim form), then Add-friend (handle search + paste code + show my code/link), Requests (incoming accept/decline), and Connections (link each to `/friends/[handle]`). Use `card`, `btn`, tokens. Poll `getFriends` on mount + after actions. Handle `configured:false` with the same "online play is being set up" copy as `Friends.tsx`. Support `?add=<code>` query → prefill + auto-connect.

```tsx
"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TopBar, AppLoading } from "@/components/ui";
import { useAccount } from "@/lib/useStore"; // use the exact accessor found in Step 1
import { getMe, claimHandle, searchHandles, connect, respond, getFriends, type FriendInfo, type PendingReq } from "@/lib/socialClient";

export default function FriendsPage() {
  const acct = useAccount(); // { name, phone } — adapt to real accessor
  const params = useSearchParams();
  const [ready, setReady] = useState(false);
  const [handle, setHandle] = useState<string | null>(null);
  const [invite, setInvite] = useState<string | null>(null);
  const [claim, setClaim] = useState("");
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [incoming, setIncoming] = useState<PendingReq[]>([]);
  const [results, setResults] = useState<{ handle: string; phone: string; name: string }[]>([]);
  const [msg, setMsg] = useState("");

  const phone = acct?.phone ?? "";
  const name = acct?.name ?? "";

  const refresh = useCallback(async () => {
    if (!phone) return;
    const me = await getMe(phone);
    setHandle(me.handle); setInvite(me.inviteCode);
    const f = await getFriends(phone);
    setFriends(f.friends); setIncoming(f.incoming);
    setReady(true);
  }, [phone]);

  useEffect(() => { refresh(); }, [refresh]);

  // ?add=CODE deep link
  useEffect(() => {
    const code = params.get("add");
    if (code && phone && handle) connect(phone, name, "code", code).then((r) => { setMsg(r.ok ? "Request sent!" : r.error || ""); refresh(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, phone, handle]);

  async function doClaim() {
    const r = await claimHandle(phone, name, claim);
    if (r.ok) refresh(); else setMsg(r.error || "Couldn't claim");
  }
  async function doSearch(q: string) {
    if (q.trim().length < 2) return setResults([]);
    setResults((await searchHandles(q, phone)).results);
  }
  async function add(target: string) {
    const r = await connect(phone, name, "handle", target);
    setMsg(r.ok ? "Request sent!" : r.error || ""); setResults([]); refresh();
  }
  async function accept(id: string) { await respond(phone, id, "accept"); refresh(); }
  async function decline(id: string) { await respond(phone, id, "decline"); refresh(); }

  if (!phone) return <AppLoading />;
  if (!ready) return <AppLoading />;

  return (
    <main className="pb-28">
      <TopBar title="Friends 👋" back />
      <div className="flex flex-col gap-4 px-4 pt-1">
        {!handle ? (
          <div className="card p-4">
            <h2 className="text-sm font-bold">Pick your @handle</h2>
            <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">Friends find you by this. 3–20 chars, a–z 0–9 _.</p>
            <div className="mt-2 flex gap-2">
              <input value={claim} onChange={(e) => setClaim(e.target.value)} placeholder="@yourhandle" className="min-w-0 flex-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-2 text-sm outline-none focus:border-[var(--color-violet)]" />
              <button onClick={doClaim} className="btn btn-primary shrink-0 !px-4 !py-2 text-sm">Claim</button>
            </div>
          </div>
        ) : (
          <>
            <div className="card p-4">
              <p className="text-xs text-[var(--color-ink-soft)]">You are</p>
              <p className="text-lg font-bold">@{handle}</p>
              <button onClick={() => navigator.clipboard?.writeText(`${location.origin}/friends?add=${invite}`).then(() => setMsg("Invite link copied!"))} className="mt-2 rounded-full bg-[var(--color-violet-soft)] px-3 py-1 text-xs font-bold text-[var(--color-violet-ink)]">Copy invite link ({invite})</button>
            </div>

            <div className="card p-4">
              <h2 className="text-sm font-bold">Add a friend</h2>
              <input onChange={(e) => doSearch(e.target.value)} placeholder="Search @handle" className="mt-2 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-2 text-sm outline-none focus:border-[var(--color-violet)]" />
              {results.map((r) => (
                <div key={r.phone} className="mt-2 flex items-center justify-between rounded-xl bg-[var(--color-paper-2)] px-3 py-2">
                  <span className="text-sm font-semibold">@{r.handle} <span className="font-normal text-[var(--color-ink-soft)]">· {r.name}</span></span>
                  <button onClick={() => add(r.handle)} className="btn btn-ghost !px-3 !py-1 text-xs">Add</button>
                </div>
              ))}
            </div>

            {incoming.length > 0 && (
              <div className="card p-4">
                <h2 className="text-sm font-bold">Requests</h2>
                {incoming.map((r) => (
                  <div key={r.id} className="mt-2 flex items-center justify-between rounded-xl bg-[var(--color-paper-2)] px-3 py-2">
                    <span className="text-sm font-semibold">@{r.handle}</span>
                    <span className="flex gap-2">
                      <button onClick={() => accept(r.id)} className="btn btn-primary !px-3 !py-1 text-xs">Accept</button>
                      <button onClick={() => decline(r.id)} className="btn btn-line !px-3 !py-1 text-xs">Decline</button>
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="card p-4">
              <h2 className="text-sm font-bold">Your friends</h2>
              {friends.length === 0 ? (
                <p className="mt-1 text-xs text-[var(--color-ink-soft)]">No friends yet — add someone above.</p>
              ) : (
                <ul className="stagger mt-2 flex flex-col gap-2">
                  {friends.map((f) => (
                    <li key={f.phone}>
                      <Link href={`/friends/${f.handle}`} className="flex items-center justify-between rounded-xl bg-[var(--color-paper-2)] px-3 py-2.5">
                        <span className="text-sm font-semibold">@{f.handle}</span>
                        <span className="text-xs text-[var(--color-ink-soft)]">Chat →</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {msg && <p className="text-center text-xs font-semibold text-[var(--color-violet-ink)]">{msg}</p>}
          </>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Add the home entry point**

In `src/app/page.tsx`, in the top bar area where the profile button renders, add before/after it a link to `/friends`:
```tsx
<Link href="/friends" aria-label="Friends" className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-card)]">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M16 11a3 3 0 1 0-2.83-4M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 0c-2.7 0-5 1.6-5 4v1h10M15 20h6v-1c0-2.2-1.9-3.7-4.2-3.95" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
</Link>
```
(Match the exact wrapper markup used by the existing profile button so alignment is consistent.)

- [ ] **Step 4: Verify in browser**

Drive with Playwright/dev app at phone width: `/friends` → claim handle → shows @handle + invite link; search a second seeded handle → Add → appears as outgoing; from the other account accept → both see each other; home top bar shows the friends icon → links to `/friends`.
Expected: full connect loop works in the UI.

- [ ] **Step 5: Commit**

```bash
git add src/app/friends/page.tsx src/app/page.tsx
git commit -m "feat: friends hub (claim handle, add, requests, connections) + home entry"
```

---

### Task 10: DM thread page + challenge action + block/report

**Files:**
- Create: `src/app/friends/[handle]/page.tsx`

**Interfaces:**
- Consumes: `socialClient` helpers; the edge-swipe-back pattern from `src/app/tutor/page.tsx` (copy the `onTouchStart/onTouchEnd` handlers); existing battle topics list (inspect `src/lib/errorTags.ts` / battle page for the topic source used in challenges).

- [ ] **Step 1: Implement `friends/[handle]/page.tsx`**

Resolve the peer's phone from the handle (via `getFriends` match on `handle`). Poll `getMessages(phone, peer, since)` every 2.5s while mounted, appending new messages. Composer sends via `sendMessage`. A "⚔️ Challenge" button opens a topic picker → `createChallenge({ threadId })`; challenge/result messages render as cards (parse `meta`). Overflow menu: Block (`respond(...,'block')` → back) + Report (`report`). Hide bottom nav (chat surface, like tutor). Include edge-swipe-back + a `TopBar ... back`.

```tsx
"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar, AppLoading } from "@/components/ui";
import { useAccount } from "@/lib/useStore"; // exact accessor from Task 9 Step 1
import { getFriends, getMessages, sendMessage, createChallenge, respond, report, type ChatMessage } from "@/lib/socialClient";

export default function ThreadPage() {
  const acct = useAccount();
  const router = useRouter();
  const handle = String(useParams().handle || "");
  const phone = acct?.phone ?? "";
  const name = acct?.name ?? "";
  const [peer, setPeer] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [showChallenge, setShowChallenge] = useState(false);
  const sinceRef = useRef<string | undefined>(undefined);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  // resolve peer phone from handle
  useEffect(() => {
    if (!phone) return;
    getFriends(phone).then((f) => { const m = f.friends.find((x) => x.handle === handle); setPeer(m?.phone ?? null); });
  }, [phone, handle]);

  const poll = useCallback(async () => {
    if (!phone || !peer) return;
    const r = await getMessages(phone, peer, sinceRef.current);
    if (r.messages.length) {
      setMessages((prev) => [...prev, ...r.messages]);
      sinceRef.current = r.messages[r.messages.length - 1].createdAt;
    }
  }, [phone, peer]);

  useEffect(() => {
    if (!peer) return;
    poll();
    const id = setInterval(poll, 2500);
    return () => clearInterval(id);
  }, [peer, poll]);

  async function send() {
    const body = text.trim();
    if (!body || !peer) return;
    setText("");
    const r = await sendMessage(phone, name, peer, body);
    if (r.ok && r.message) { setMessages((p) => [...p, r.message!]); sinceRef.current = r.message.createdAt; }
  }
  async function challenge(topic: string) {
    if (!peer) return;
    setShowChallenge(false);
    // thread id: any message carries it via getMessages; fetch once
    const r = await getMessages(phone, peer);
    if (r.threadId) await createChallenge(phone, name, topic, { participants: [peer], threadId: r.threadId });
    poll();
  }

  const onTouchStart = (e: React.TouchEvent) => { const t = e.touches[0]; swipe.current = { x: t.clientX, y: t.clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = swipe.current; swipe.current = null; if (!s) return;
    const t = e.changedTouches[0]; if (s.x < 60 && t.clientX - s.x > 70 && Math.abs(t.clientY - s.y) < 50) router.back();
  };

  if (!phone) return <AppLoading />;

  return (
    <main className="flex h-[100dvh] flex-col" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <TopBar title={`@${handle}`} back right={
        <button onClick={async () => { const f = await getFriends(phone); const fr = f.friends.find((x) => x.handle === handle); if (fr) { await respond(phone, /* friendship id not exposed here */ "", "block"); } }} className="text-xs font-semibold text-[var(--color-ink-soft)]">⋯</button>
      } />
      <div className="flex-1 overflow-y-auto px-4 pt-2">
        {messages.map((m) => (
          <ChatBubble key={m.id} m={m} mine={m.sender === phone} />
        ))}
      </div>
      {showChallenge && <TopicPicker onPick={challenge} onClose={() => setShowChallenge(false)} />}
      <div className="border-t border-[var(--color-line)] bg-[var(--color-paper)]/95 px-3 py-3 backdrop-blur" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowChallenge(true)} aria-label="Challenge" className="btn btn-ghost !px-3 !py-2 text-sm">⚔️</button>
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Message…" className="min-w-0 flex-1 rounded-full border border-[var(--color-line)] bg-[var(--color-card)] px-4 py-2 text-sm outline-none focus:border-[var(--color-violet)]" />
          <button onClick={send} disabled={!text.trim()} className="btn btn-primary shrink-0 !h-10 !w-10 !p-0">→</button>
        </div>
      </div>
    </main>
  );
}
```

Note: the overflow "block" needs the friendship id — expose it by extending `FriendInfo` to include the friendship `id` (add `id` to the `friends` mapping in Task 4's `friends/route.ts` and to `FriendInfo` in Task 8). Do that adjustment as part of this task.

- [ ] **Step 2: Implement `ChatBubble` + `TopicPicker` (same file, below the default export)**

```tsx
function ChatBubble({ m, mine }: { m: ChatMessage; mine: boolean }) {
  if (m.kind === "challenge") {
    const meta = m.meta as { topic?: string; challengeId?: string } | null;
    return (
      <div className="my-1 rounded-2xl bg-[var(--color-violet-soft)] p-3 text-center">
        <p className="text-sm font-bold text-[var(--color-violet-ink)]">⚔️ Challenge: {meta?.topic}</p>
        <a href={`/battle/challenge/${meta?.challengeId}`} className="mt-1 inline-block text-xs font-semibold underline">Play →</a>
      </div>
    );
  }
  if (m.kind === "result") {
    const meta = m.meta as { ranked?: { phone: string; score: number; rank: number; winner: boolean }[] } | null;
    return (
      <div className="my-1 rounded-2xl border border-[var(--color-line)] p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-ink-soft)]">Result 🏆</p>
        {(meta?.ranked ?? []).map((r) => <p key={r.phone} className="text-sm">{r.rank}. {r.score}/10 {r.winner ? "🏆" : ""}</p>)}
      </div>
    );
  }
  return (
    <div className={`my-1 flex ${mine ? "justify-end" : "justify-start"}`}>
      <span className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-[var(--color-ink)] text-[var(--color-card)]" : "bg-[var(--color-paper-2)]"}`}>{m.body}</span>
    </div>
  );
}

function TopicPicker({ onPick, onClose }: { onPick: (t: string) => void; onClose: () => void }) {
  const topics = ["Rotational Motion", "Thermodynamics", "Organic Reactions", "Calculus", "Electrostatics"]; // replace with the app's real topic source (errorTags/battle) during impl
  return (
    <div className="border-t border-[var(--color-line)] bg-[var(--color-card)] p-3">
      <div className="mb-2 flex items-center justify-between"><span className="text-sm font-bold">Challenge topic</span><button onClick={onClose} className="text-xs">✕</button></div>
      <div className="flex flex-wrap gap-2">{topics.map((t) => <button key={t} onClick={() => onPick(t)} className="chip">{t}</button>)}</div>
    </div>
  );
}
```

- [ ] **Step 3: Verify in browser**

With two seeded accepted friends: open `/friends/<handle>`, send a message → appears; from the other account (second browser/localStorage) send → appears within ~2.5s via poll; tap ⚔️ → pick topic → challenge card posts; play both sides → result card shows winner. Confirm bottom nav is hidden and back arrow works.
Expected: chat + challenge round-trip works end-to-end.

- [ ] **Step 4: Commit**

```bash
git add src/app/friends/[handle]/page.tsx src/app/api/social/friends/route.ts src/lib/socialClient.ts
git commit -m "feat: DM thread (polling chat), challenge action, block/report, result cards"
```

---

### Task 11: Challenge play route + wiki update

**Files:**
- Create: `src/app/battle/challenge/[id]/page.tsx` (plays a challenge's frozen question set)
- Modify: `llm-wiki/index.md`, `llm-wiki/log.md`

**Interfaces:**
- Consumes: `getChallenge(id)`, `submitChallengeScore` (Task 8); the existing Battle quiz-runner UI (inspect `src/app/battle/[topic]/page.tsx` and reuse its question-rendering/timer logic against a supplied question set rather than a generated one).

- [ ] **Step 1: Inspect the battle runner**

Read `src/app/battle/[topic]/page.tsx`. Identify how it renders a question set + timer + scoring. Extract or reuse that to build a variant that takes `questions` from `getChallenge(id)` instead of generating, and on finish calls `submitChallengeScore(id, phone, score, timeMs)`, then shows the ranked result.

- [ ] **Step 2: Implement `battle/challenge/[id]/page.tsx`**

Load `getChallenge(id)`; render its `questions` through the same runner; on finish submit score and display `ranked` (reuse the result-card styling). Guard: if `configured:false` or not found, show a friendly message + link back to `/friends`. (Full code mirrors the battle runner found in Step 1 — keep the exact question shape and timer it uses.)

- [ ] **Step 3: Verify**

Open a challenge link `/battle/challenge/<id>` from the thread → play 10 Qs → score submits → result card with ranking shows; the thread's result message appears once both have played.
Expected: end-to-end challenge play works.

- [ ] **Step 4: Update the wiki**

In `llm-wiki/index.md`: add the `/friends` + `/friends/[handle]` + `/battle/challenge/[id]` routes, the `/api/social/*` routes, the `0005_social` tables, and `src/lib/social.ts` / `socialClient.ts` to the relevant sections. Append a dated entry to `llm-wiki/log.md` summarizing social slice B.

- [ ] **Step 5: Commit**

```bash
git add src/app/battle/challenge llm-wiki/index.md llm-wiki/log.md
git commit -m "feat: play a challenge (frozen set) + docs for social slice B"
```

---

## Self-Review Notes (author)

- **Spec coverage:** handles+invite (T2,T3), connect by handle/code + requests + block (T4), 1:1 polling chat (T5), async challenge 1–8 + frozen set + ranked (T6), report (T7), client (T8), UI hub + home entry (T9), thread + challenge action + safety (T10), challenge play + wiki (T11). All spec sections mapped.
- **Known impl-time lookups (flagged in-task, not placeholders):** exact quiz generator name/shape in `ai.ts` (T6 S1), current-account accessor (T9 S1), battle runner reuse (T11 S1), real topic list (T10 S2). These are "inspect existing code and match it" steps, deliberately not guessed.
- **Type consistency:** `RankedScore` defined in `social.ts` (T1), re-exported via `socialClient` (T8), consumed in T6/T10/T11. `FriendInfo` gains `id` in T10 (noted in both route + client). Message `kind` union identical across T5/T8/T10.
- **Boundary:** no browser→Supabase anywhere; all UI goes through `socialClient` → `/api/social/*`. Polling only.
