"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar, AppLoading } from "@/components/ui";
import { Friends } from "@/components/Friends";
import { FeedbackForm } from "@/components/FeedbackForm";
import { clearAccount, computeProfile, getAccount, saveAccount } from "@/lib/store";
import { saveProfile } from "@/lib/socialClient";
import { useStoreVersion, useMounted } from "@/lib/useStore";
import { useTheme } from "@/lib/theme";
import type { Subject } from "@/lib/types";

const CLASSES = ["Class 11", "Class 12", "Dropper"];
const SUBJECTS: Subject[] = ["Physics", "Chemistry", "Maths"];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "🙂";
}

export default function ProfilePage() {
  const router = useRouter();
  const v = useStoreVersion();
  const mounted = useMounted();
  const { theme, toggle } = useTheme();

  const account = useMemo(() => getAccount(), [v]);
  const profile = useMemo(() => computeProfile(), [v]);

  if (!mounted) return <AppLoading />;
  if (!account) {
    router.replace("/login");
    return null;
  }

  function logout() {
    clearAccount();
    router.replace("/login");
  }

  return (
    <main className="pb-16">
      <TopBar title="Profile" back="/" />

      <div className="px-4">
        {/* identity */}
        <div className="flex flex-col items-center pb-2 pt-3 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[var(--color-violet)] text-2xl font-extrabold text-white shadow-[var(--shadow-card)]">
            {initials(account.name)}
          </div>
          <h2 className="mt-3 text-xl font-extrabold">{account.name}</h2>
          <p className="text-sm text-[var(--color-ink-soft)]">+91 {account.phone}</p>
        </div>

        {/* fun stats */}
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <div className="card p-4 text-center">
            <p className="text-2xl font-extrabold text-[var(--color-violet)]">{profile.papersLogged}</p>
            <p className="text-xs font-semibold text-[var(--color-ink-soft)]">papers reviewed</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-extrabold text-[var(--color-violet)]">{profile.totalDiagnosed}</p>
            <p className="text-xs font-semibold text-[var(--color-ink-soft)]">mistakes decoded</p>
          </div>
        </div>

        {/* settings */}
        <div className="card mt-4 divide-y divide-[var(--color-line)]">
          <button
            onClick={toggle}
            className="flex w-full items-center gap-3 p-4 text-left"
          >
            <span className="text-xl">{theme === "dark" ? "🌙" : "☀️"}</span>
            <span className="flex-1 font-semibold">Dark mode</span>
            <Switch on={theme === "dark"} />
          </button>
        </div>

        <StudyProfile phone={account.phone} name={account.name} klass={account.klass} weakSubject={account.weakSubject} />

        <Friends phone={account.phone} name={account.name} />

        <FeedbackForm />

        <button onClick={logout} className="btn btn-line mt-5 w-full text-[var(--color-bad)]">
          Log out
        </button>
      </div>
    </main>
  );
}

function StudyProfile({ phone, name, klass, weakSubject }: { phone: string; name: string; klass?: string; weakSubject?: Subject }) {
  const [k, setK] = useState(klass ?? "");
  const [w, setW] = useState<Subject | "">(weakSubject ?? "");
  function set(nextK: string, nextW: Subject | "") {
    setK(nextK);
    setW(nextW);
    saveAccount(name, phone, { klass: nextK || undefined, weakSubject: (nextW || undefined) as Subject | undefined });
    saveProfile(phone, name, nextK || undefined, nextW || undefined).catch(() => {});
  }
  return (
    <div className="card mt-4 p-4">
      <h3 className="text-sm font-bold">Study profile</h3>
      <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">Pitches challenge papers at your level — and helps your future coach.</p>
      <p className="mb-1.5 mt-3 text-xs font-semibold">Class</p>
      <div className="flex flex-wrap gap-2">
        {CLASSES.map((c) => (
          <button key={c} className="chip" data-on={k === c} onClick={() => set(c, w)}>{c}</button>
        ))}
      </div>
      <p className="mb-1.5 mt-3 text-xs font-semibold">Toughest subject</p>
      <div className="flex flex-wrap gap-2">
        {SUBJECTS.map((s) => (
          <button key={s} className="chip" data-on={w === s} onClick={() => set(k, s)}>{s}</button>
        ))}
      </div>
    </div>
  );
}

function Switch({ on }: { on: boolean }) {
  return (
    <span
      className="relative inline-flex h-7 w-12 items-center rounded-full transition-colors"
      style={{ background: on ? "var(--color-violet)" : "var(--color-line)" }}
    >
      <span
        className="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? "translateX(22px)" : "translateX(3px)" }}
      />
    </span>
  );
}
