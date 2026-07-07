"use client";
import type { RankedScore } from "@/lib/social";
export type { RankedScore };

export interface FriendInfo { id: string; phone: string; handle: string; name: string }
export interface PendingReq { id: string; phone: string; handle: string; name: string }
export interface ChatMessage { id: string; sender: string; body: string; kind: "text" | "challenge" | "result" | "gif"; meta: unknown; createdAt: string }
export interface ChallengeView { topic: string; questions: unknown[]; participants: string[]; status: string; scores: RankedScore[] }

const j = (r: Response) => r.json();
const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(j);

export const getMe = (phone: string) =>
  fetch(`/api/social/me?phone=${phone}`).then(j) as Promise<{ configured: boolean; handle: string | null; inviteCode: string | null; pending: number }>;
export const claimHandle = (phone: string, name: string, handle: string) =>
  post("/api/social/handle", { phone, name, handle }) as Promise<{ ok: boolean; handle?: string; inviteCode?: string; error?: string }>;
export const searchHandles = (q: string, me: string) =>
  fetch(`/api/social/handle?q=${encodeURIComponent(q)}&me=${me}`).then(j) as Promise<{ results: { handle: string; phone: string; name: string }[] }>;

export const connect = (phone: string, name: string, by: "handle" | "code", value: string) =>
  post("/api/social/connect", { phone, name, by, value }) as Promise<{ ok: boolean; status?: string; error?: string }>;
export const respond = (phone: string, friendshipId: string, action: "accept" | "decline" | "block") =>
  post("/api/social/respond", { phone, friendshipId, action }) as Promise<{ ok: boolean }>;
export const getFriends = (phone: string) =>
  fetch(`/api/social/friends?phone=${phone}`).then(j) as Promise<{ configured: boolean; friends: FriendInfo[]; incoming: PendingReq[]; outgoing: PendingReq[] }>;

export const getMessages = (phone: string, peer: string, since?: string) =>
  fetch(`/api/social/messages?phone=${phone}&peer=${peer}${since ? `&since=${encodeURIComponent(since)}` : ""}`).then(j) as Promise<{ threadId: string | null; messages: ChatMessage[] }>;
export const sendMessage = (phone: string, name: string, peer: string, body: string) =>
  post("/api/social/messages", { phone, name, peer, body }) as Promise<{ ok: boolean; message?: ChatMessage; error?: string }>;

export const createChallenge = (phone: string, name: string, topic: string, opts: { subject?: string; participants?: string[]; groupCode?: string; threadId?: string }) =>
  post("/api/social/challenge", { phone, name, topic, ...opts }) as Promise<{ ok: boolean; challengeId?: string; questions?: unknown[]; error?: string }>;
export const getChallenge = (id: string) =>
  fetch(`/api/social/challenge?id=${id}`).then(j) as Promise<ChallengeView & { configured: boolean; error?: string }>;
export const submitChallengeScore = (challengeId: string, phone: string, score: number, timeMs: number) =>
  post("/api/social/challenge/score", { challengeId, phone, score, timeMs }) as Promise<{ ok: boolean; ranked: RankedScore[]; closed: boolean }>;

export const report = (reporter: string, target: string, opts: { messageId?: string; reason?: string }) =>
  post("/api/social/report", { reporter, target, ...opts }) as Promise<{ ok: boolean }>;
