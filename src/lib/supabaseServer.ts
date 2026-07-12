import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client using the SERVICE ROLE key. This bypasses RLS, so
// it must NEVER be imported into client code. All multiplayer DB access goes
// through our API routes; the browser never talks to Supabase directly.
const URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseConfigured = () => Boolean(URL && SERVICE_KEY);

let _client: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!_client) {
    _client = createClient(URL!, SERVICE_KEY!, { auth: { persistSession: false } });
  }
  return _client;
}

// Push a realtime event to everyone subscribed to `topic` (Supabase Realtime
// Broadcast over HTTP — stateless, so it works from serverless routes without
// holding a websocket). Best-effort: a miss self-heals via focus refetch.
export async function broadcast(topic: string, event: string, payload: unknown): Promise<void> {
  if (!supabaseConfigured()) return;
  try {
    await fetch(`${URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY!,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ messages: [{ topic, event, payload }] }),
    });
  } catch (err) {
    console.error("broadcast error", err);
  }
}

// Ensure a student row exists / name is current. Safe to call on every action.
// Only overwrites class/weak_subject when explicitly provided, so a plain
// (phone, name) call from another route never wipes the profile.
export async function upsertStudent(phone: string, name: string, extra?: { klass?: string; weakSubject?: string }) {
  const row: Record<string, string> = { phone, name };
  if (extra?.klass) row.class = extra.klass;
  if (extra?.weakSubject) row.weak_subject = extra.weakSubject;
  await supabase().from("students").upsert(row, { onConflict: "phone" });
}

// The student's self-reported class, for pitching a curated paper at their level.
export async function studentClass(phone: string): Promise<string | null> {
  const { data } = await supabase().from("students").select("class").eq("phone", phone).maybeSingle();
  return (data?.class as string | null) ?? null;
}
