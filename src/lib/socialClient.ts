"use client";
import type { RankedScore } from "@/lib/social";
export type { RankedScore };

export interface FriendInfo { id: string; phone: string; handle: string; name: string }
export interface PendingReq { id: string; phone: string; handle: string; name: string; bio?: string | null }
export interface ChatMessage { id: string; sender: string; body: string; kind: "text" | "challenge" | "result" | "gif" | "vote" | "sticker"; meta: unknown; createdAt: string }
export interface PeerInfo { phone: string; handle: string; bio: string | null; status: "none" | "pending" | "accepted" | "blocked" }
export interface ChallengeView { topic: string; subject: string; questions: unknown[]; participants: string[]; status: string; scores: RankedScore[] }

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
  get(`/api/social/me?phone=${phone}`) as Promise<{ configured: boolean; handle: string | null; inviteCode: string | null; bio: string | null; pending: number }>;
export const saveBio = (phone: string, bio: string) =>
  post("/api/social/me", { phone, bio }) as Promise<{ ok: boolean; bio: string | null }>;
export const getPeers = (me: string, phones: string[]) =>
  get(`/api/social/peers?me=${me}&phones=${phones.join(",")}`) as Promise<{ peers: PeerInfo[] }>;
export const claimHandle = (phone: string, name: string, handle: string, change = false) =>
  post("/api/social/handle", { phone, name, handle, change }) as Promise<{ ok: boolean; handle?: string; inviteCode?: string; error?: string }>;
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
export const sendMessage = (phone: string, name: string, peer: string, body: string, kind: "text" | "sticker" = "text") =>
  post("/api/social/messages", { phone, name, peer, body, kind }) as Promise<{ ok: boolean; message?: ChatMessage; error?: string }>;

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

// Server picks the topic from the JEE syllabus ladder (common weak areas
// first, beginner → advanced) — the student only chooses the subject.
export const startSubjectChallenge = (phone: string, name: string, subject: string, peer: string, threadId?: string) =>
  post("/api/social/challenge", { phone, name, subject, participants: [peer], threadId }) as Promise<{ ok: boolean; challengeId?: string; topic?: string; error?: string }>;
