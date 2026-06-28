"use client";

import { useEffect } from "react";

// Registers the service worker so the app is installable on Android (PWA).
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return; // avoid dev caching headaches
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
