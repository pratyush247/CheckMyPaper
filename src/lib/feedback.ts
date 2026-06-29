"use client";

import { getAccount } from "./store";

export type FeedbackType = "reaction" | "idea" | "bug" | "love";

export async function sendFeedback(p: {
  type: FeedbackType;
  target?: string;
  rating?: "up" | "down";
  message?: string;
}): Promise<boolean> {
  const acct = getAccount();
  try {
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...p, phone: acct?.phone, name: acct?.name }),
    });
    const data = (await res.json()) as { ok?: boolean };
    return Boolean(data.ok);
  } catch {
    return false;
  }
}
