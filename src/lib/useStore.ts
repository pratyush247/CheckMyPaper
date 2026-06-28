"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

// A tiny reactive bridge over the localStorage-backed store. Components call
// useStoreVersion() and re-read store selectors; the value changes whenever the
// store mutates (this tab or another), forcing a fresh read.

let version = 0;
const listeners = new Set<() => void>();

function notify() {
  version += 1;
  listeners.forEach((l) => l());
}

let wired = false;
function ensureWired() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  window.addEventListener("cmp-store-change", notify);
  window.addEventListener("storage", notify);
}

function subscribe(cb: () => void) {
  ensureWired();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const getSnapshot = () => version;
const getServerSnapshot = () => 0;

export function useStoreVersion() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// True only after the component has mounted on the client. Use to gate any
// rendering that reads the localStorage store, so the first client render
// matches the (empty) server render and hydration stays clean.
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
