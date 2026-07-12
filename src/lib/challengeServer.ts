import { supabase, studentClass, broadcast } from "@/lib/supabaseServer";
import { generateQuiz } from "@/lib/ai";
import { commonWeakTopics, type TopicRef } from "@/lib/social";
import { pickChallengeTopic, sharedClass, type CoreSubject } from "@/lib/syllabus";

// Pick the next topic for a pair from the JEE syllabus ladder: their common
// weak areas in this subject first, else the earliest unplayed topic for their
// shared class, stepping up in difficulty as they keep battling.
export async function pickTopicForPair(me: string, peer: string, subject: CoreSubject): Promise<{ topic: string; difficulty: 1 | 2 | 3 }> {
  const { data: hs } = await supabase().from("handles").select("phone, weak_topics").in("phone", [me, peer]);
  const weakOf = (p: string): TopicRef[] => {
    const raw = (hs ?? []).find((r) => r.phone === p)?.weak_topics;
    return Array.isArray(raw) ? (raw as TopicRef[]) : [];
  };
  const commonWeak = commonWeakTopics(weakOf(me), weakOf(peer))
    .filter((t) => t.subject === subject || t.subject === "Unknown")
    .map((t) => t.topic);

  const { data: ss } = await supabase().from("students").select("phone, class").in("phone", [me, peer]);
  const classOf = (p: string) => ((ss ?? []).find((r) => r.phone === p)?.class as string | null) ?? null;

  const { data: prior } = await supabase()
    .from("challenges")
    .select("topic")
    .eq("subject", subject)
    .contains("participant_phones", [me, peer]);
  const played = (prior ?? []).map((c) => c.topic as string);

  return pickChallengeTopic({
    subject,
    klass: sharedClass(classOf(me), classOf(peer)),
    commonWeak,
    played,
    battlesInSubject: played.length,
  });
}

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
  difficulty?: 1 | 2 | 3;
  postCard?: boolean; // post a "challenge" DM card (skip when the caller shows its own)
}): Promise<{ challengeId: string; questions: unknown[] }> {
  const className = await studentClass(opts.creatorPhone).catch(() => null);
  const questions = await generateQuiz(opts.topic, opts.subject, 10, { className: className ?? undefined, difficulty: opts.difficulty });
  const ins = await supabase()
    .from("challenges")
    .insert({
      topic: opts.topic,
      subject: opts.subject,
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
