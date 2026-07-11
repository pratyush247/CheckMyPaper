"use client";
import type { RankedScore } from "@/lib/social";
export type { RankedScore };

export interface FriendInfo { id: string; phone: string; handle: string; name: string }
export interface PendingReq { id: string; phone: string; handle: string; name: string }
export interface ChatMessage { id: string; sender: string; body: string; kind: "text" | "challenge" | "result" | "gif" | "vote"; meta: unknown; createdAt: string }
export interface ChallengeView { topic: string; questions: unknown[]; participants: string[]; status: string; scores: RankedScore[] }

const j = (r: Response) => r.json();

// fetch() rejects ("TypeError: Load failed" / "Failed to fetch") on a network
// blip — a Turbopack route compiling on first hit, an HMR socket reset, a
// flaky connection. Retry once so a transient failure doesn't crash the page.
async function req(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    await new Promise((r) => setTimeout(r, 400));
    return fetch(url, init);
  }
}
const get = (url: string) => req(url).then(j);
const post = (url: string, body: unknown) =>
  req(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(j);

export const getMe = (phone: string) =>
  get(`/api/social/me?phone=${phone}`) as Promise<{ configured: boolean; handle: string | null; inviteCode: string | null; pending: number }>;
export const claimHandle = (phone: string, name: string, handle: string) =>
  post("/api/social/handle", { phone, name, handle }) as Promise<{ ok: boolean; handle?: string; inviteCode?: string; error?: string }>;
export const searchHandles = (q: string, me: string) =>
  get(`/api/social/handle?q=${encodeURIComponent(q)}&me=${me}`) as Promise<{ results: { handle: string; phone: string; name: string }[] }>;

export const connect = (phone: string, name: string, by: "handle" | "code", value: string) =>
  post("/api/social/connect", { phone, name, by, value }) as Promise<{ ok: boolean; status?: string; error?: string }>;
export const respond = (phone: string, friendshipId: string, action: "accept" | "decline" | "block") =>
  post("/api/social/respond", { phone, friendshipId, action }) as Promise<{ ok: boolean }>;
export const getFriends = (phone: string) =>
  get(`/api/social/friends?phone=${phone}`) as Promise<{ configured: boolean; friends: FriendInfo[]; incoming: PendingReq[]; outgoing: PendingReq[] }>;

export const getMessages = (phone: string, peer: string, since?: string) =>
  get(`/api/social/messages?phone=${phone}&peer=${peer}${since ? `&since=${encodeURIComponent(since)}` : ""}`) as Promise<{ threadId: string | null; messages: ChatMessage[] }>;
export const sendMessage = (phone: string, name: string, peer: string, body: string) =>
  post("/api/social/messages", { phone, name, peer, body }) as Promise<{ ok: boolean; message?: ChatMessage; error?: string }>;

export const createChallenge = (phone: string, name: string, topic: string, opts: { subject?: string; participants?: string[]; groupCode?: string; threadId?: string }) =>
  post("/api/social/challenge", { phone, name, topic, ...opts }) as Promise<{ ok: boolean; challengeId?: string; questions?: unknown[]; error?: string }>;
export const getChallenge = (id: string) =>
  get(`/api/social/challenge?id=${id}`) as Promise<ChallengeView & { configured: boolean; error?: string }>;
export const submitChallengeScore = (challengeId: string, phone: string, score: number, timeMs: number) =>
  post("/api/social/challenge/score", { challengeId, phone, score, timeMs }) as Promise<{ ok: boolean; ranked: RankedScore[]; closed: boolean }>;

export const report = (reporter: string, target: string, opts: { messageId?: string; reason?: string }) =>
  post("/api/social/report", { reporter, target, ...opts }) as Promise<{ ok: boolean }>;

export const saveProfile = (phone: string, name: string, klass?: string, weakSubject?: string) =>
  post("/api/social/profile", { phone, name, klass, weakSubject }) as Promise<{ ok: boolean }>;

export interface TopicRef { topic: string; subject: string }
export const syncWeakTopics = (phone: string, topics: TopicRef[]) =>
  post("/api/social/weak-topics", { phone, topics }) as Promise<{ ok: boolean }>;
export const getChallengeTopics = (me: string, peer: string) =>
  get(`/api/social/weak-topics?me=${me}&peer=${peer}`) as Promise<{ configured: boolean; common: TopicRef[]; subjects: string[] }>;

export interface VoteOption { id: string; topic: string; subject: string }
export interface VoteView {
  configured: boolean; id: string; options: VoteOption[]; votes: Record<string, string>;
  participants: string[]; status: string; chosenTopic: string | null; challengeId: string | null; error?: string;
}
export const createVote = (phone: string, name: string, threadId: string, participants: string[], options: VoteOption[]) =>
  post("/api/social/vote", { phone, name, threadId, participants, options }) as Promise<{ ok: boolean; voteId?: string; error?: string }>;
export const getVote = (id: string) =>
  get(`/api/social/vote?id=${id}`) as Promise<VoteView>;
export const castVote = (voteId: string, phone: string, optionId: string) =>
  post("/api/social/vote/cast", { voteId, phone, optionId }) as Promise<{ ok: boolean; closed: boolean; challengeId?: string; votes?: Record<string, string> }>;
