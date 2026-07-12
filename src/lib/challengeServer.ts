import { supabase, studentClass, broadcast } from "@/lib/supabaseServer";
import { generateQuiz } from "@/lib/ai";

// Server-only. Generates a frozen 10-question set and inserts a challenge,
// optionally posting a challenge card into a DM thread. Shared by the direct
// challenge route and the vote-resolution path so the logic lives in one place.
export async function createChallengeRecord(opts: {
  creatorPhone: string;
  topic: string;
  subject: string;
  participants: string[];
  threadId?: string | null;
  groupCode?: string | null;
  postCard?: boolean; // post a "challenge" DM card (skip when a vote card already shows the result)
}): Promise<{ challengeId: string; questions: unknown[] }> {
  const className = await studentClass(opts.creatorPhone).catch(() => null);
  const questions = await generateQuiz(opts.topic, opts.subject, 10, { className: className ?? undefined });
  const ins = await supabase()
    .from("challenges")
    .insert({
      topic: opts.topic,
      creator_phone: opts.creatorPhone,
      question_set: questions,
      participant_phones: opts.participants,
      status: "open",
      thread_id: opts.threadId ?? null,
      group_code: opts.groupCode ?? null,
      expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
    })
    .select("id")
    .single();
  const challengeId = ins.data?.id as string;

  if (opts.threadId && opts.postCard !== false) {
    const card = await supabase().from("dm_messages").insert({
      thread_id: opts.threadId, sender_phone: opts.creatorPhone, kind: "challenge",
      body: `Challenge: ${opts.topic}`, meta: { challengeId, topic: opts.topic },
    }).select("*").single();
    await supabase().from("dm_threads").update({ last_message_at: new Date().toISOString() }).eq("id", opts.threadId);
    const m = card.data as Record<string, unknown> | null;
    if (m) await broadcast(`dm:${opts.threadId}`, "message", { id: m.id, sender: m.sender_phone, body: m.body, kind: m.kind, meta: m.meta ?? null, createdAt: m.created_at });
  }
  return { challengeId, questions };
}
