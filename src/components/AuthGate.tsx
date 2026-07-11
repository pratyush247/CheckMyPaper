"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAccount } from "@/lib/store";
import { useMounted } from "@/lib/useStore";
import { HandleGate } from "@/components/HandleGate";

// Lightweight local-first gate: no account → /login; on /login with an account → home.
// SSR and the pre-mount frame render children as-is, so server rendering is preserved.
export function AuthGate({ children }: { children: React.ReactNode }) {
  const mounted = useMounted();
  const path = usePathname();
  const router = useRouter();

  const account = mounted ? getAccount() : null;
  // /admin is for the team reviewing feedback — not gated behind a student login.
  const needsLogin = mounted && !account && path !== "/login" && !path.startsWith("/admin");
  const needsHome = mounted && !!account && path === "/login";

  useEffect(() => {
    if (needsLogin) router.replace("/login");
    if (needsHome) router.replace("/");
  }, [needsLogin, needsHome, router]);

  if (!mounted) return <>{children}</>;
  if (needsLogin || needsHome) return null;
  return (
    <>
      <HandleGate />
      {children}
    </>
  );
}
