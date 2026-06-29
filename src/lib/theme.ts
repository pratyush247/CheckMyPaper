"use client";

import { useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "cmp.theme";

export function getTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem(KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", t === "dark");
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", t === "dark" ? "#16130f" : "#faf6ef");
}

export function setTheme(t: Theme) {
  window.localStorage.setItem(KEY, t);
  applyTheme(t);
}

// Reads the current theme on mount and exposes a toggle.
export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void } {
  const [theme, set] = useState<Theme>("light");
  useEffect(() => set(getTheme()), []);
  const update = (t: Theme) => {
    setTheme(t);
    set(t);
  };
  return { theme, setTheme: update, toggle: () => update(theme === "dark" ? "light" : "dark") };
}

// Inline script (run before paint) that applies the saved/system theme to avoid
// a flash of the wrong colors. Injected in the document <head>.
export const themeBootstrapScript = `(function(){try{var t=localStorage.getItem('${KEY}');if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;
