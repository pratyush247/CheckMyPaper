"use client";

import { getAccount, getAllMistakes } from "./store";

export interface ChatTurn { role: "user" | "assistant"; content: string }

// Push the student's diagnosed mistakes into the RAG store (idempotent).
export async function syncMistakes(): Promise<{ configured: boolean; synced?: number; total?: number }> {
  const acct = getAccount();
  if (!acct) return { configured: false };
  try {
    const res = await fetch("/api/tutor/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: acct.phone, name: acct.name, mistakes: getAllMistakes() }),
    });
    return await res.json();
  } catch {
    return { configured: false };
  }
}

export async function tutorChat(
  message: string,
  history: ChatTurn[],
): Promise<{ answer: string; configured?: boolean; usedTopics?: string[] }> {
  const acct = getAccount();
  if (!acct) return { answer: "Please log in first." };
  try {
    const res = await fetch("/api/tutor/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: acct.phone, message, history }),
    });
    return await res.json();
  } catch {
    return { answer: "Couldn't reach your tutor — check your connection and try again." };
  }
}
