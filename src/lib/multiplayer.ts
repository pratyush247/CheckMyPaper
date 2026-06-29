"use client";

import type { Racer } from "./battle";

// Client helpers for the shared (Supabase-backed) multiplayer features. Every
// call degrades gracefully: if the backend isn't configured, callers fall back
// to the local/seeded experience.

export interface ApiRacer { name: string; score: number; timeMs: number; phone: string }
export interface Group { code: string; name: string }

export async function submitScore(p: {
  phone: string; name: string; topic: string; score: number; timeMs: number;
}): Promise<void> {
  try {
    await fetch("/api/battle/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
  } catch {
    /* leaderboard is best-effort */
  }
}

export async function fetchLeaderboard(
  topic: string,
  scope: "global" | "group",
  code?: string,
): Promise<{ configured: boolean; racers: ApiRacer[] }> {
  try {
    const qs = new URLSearchParams({ topic, scope });
    if (code) qs.set("code", code);
    const res = await fetch(`/api/leaderboard?${qs}`);
    const data = (await res.json()) as { configured?: boolean; racers?: ApiRacer[] };
    return { configured: Boolean(data.configured), racers: data.racers ?? [] };
  } catch {
    return { configured: false, racers: [] };
  }
}

export async function listGroups(phone: string): Promise<{ configured: boolean; groups: Group[] }> {
  try {
    const res = await fetch(`/api/group?phone=${encodeURIComponent(phone)}`);
    const data = (await res.json()) as { configured?: boolean; groups?: Group[] };
    return { configured: Boolean(data.configured), groups: data.groups ?? [] };
  } catch {
    return { configured: false, groups: [] };
  }
}

export async function createGroup(phone: string, name: string, groupName: string) {
  const res = await fetch("/api/group", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create", phone, name, groupName }),
  });
  return (await res.json()) as { ok: boolean; code?: string; name?: string; error?: string; configured?: boolean };
}

export async function joinGroup(phone: string, name: string, code: string) {
  const res = await fetch("/api/group", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "join", phone, name, code }),
  });
  return (await res.json()) as { ok: boolean; code?: string; name?: string; error?: string; configured?: boolean };
}

// Map an API racer to the shared Racer shape, flagging the current student.
export function toRacer(r: ApiRacer, myPhone: string): Racer {
  return { name: r.phone === myPhone ? "You" : r.name, score: r.score, timeMs: r.timeMs, you: r.phone === myPhone };
}
