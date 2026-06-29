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

// Ensure a student row exists / name is current. Safe to call on every action.
export async function upsertStudent(phone: string, name: string) {
  await supabase().from("students").upsert({ phone, name }, { onConflict: "phone" });
}
