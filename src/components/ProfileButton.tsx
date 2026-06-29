"use client";

import Link from "next/link";
import { getAccount } from "@/lib/store";
import { useStoreVersion } from "@/lib/useStore";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "🙂";
}

// Avatar button (top-left) showing the student's initials; opens the profile.
export function ProfileButton() {
  useStoreVersion();
  const account = getAccount();
  if (!account) return null;
  return (
    <Link
      href="/profile"
      aria-label="Profile"
      className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-violet)] text-sm font-extrabold text-white shadow-[var(--shadow-card)]"
    >
      {initials(account.name)}
    </Link>
  );
}
