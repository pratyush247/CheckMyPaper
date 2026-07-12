"use client";

import { useEffect, useRef } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser-side Supabase client used ONLY for Realtime Broadcast subscriptions.
// The anon key has zero table access (RLS on, no policies) — the local-first
// boundary holds: all data still flows through our API routes; this socket
// only carries "something changed" pings + already-authorized payloads.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const realtimeConfigured = () => Boolean(URL && ANON);

let _client: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (!_client) _client = createClient(URL!, ANON!, { auth: { persistSession: false } });
  return _client;
}

/**
 * Subscribe to a broadcast topic while mounted. `onEvent(event, payload)` fires
 * for every broadcast on the topic. Pass a null topic to skip (e.g. while the
 * id is still loading). The handler is kept in a ref so callers don't need to
 * memoize it.
 */
export function useRealtime(topic: string | null, onEvent: (event: string, payload: unknown) => void) {
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (!topic || !realtimeConfigured()) return;
    const ch = client()
      .channel(topic)
      .on("broadcast", { event: "*" }, (msg) => handler.current(msg.event, msg.payload))
      .subscribe();
    return () => {
      client().removeChannel(ch);
    };
  }, [topic]);
}

/** Re-run `fn` when the tab becomes visible again — heals any missed broadcast. */
export function useFocusRefetch(fn: () => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const onVis = () => document.visibilityState === "visible" && ref.current();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, []);
}
