"use client";

import { useEffect } from "react";

// Registers the service worker so the app is installable on Android (PWA).
export function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      // A service worker left over from a prod build (or an old deploy) keeps
      // intercepting requests on localhost and causes stale responses or
      // "Load failed" in dev. Tear it down so dev is always clean.
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
