"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveAccount } from "@/lib/store";
import { saveProfile, lookupProfile } from "@/lib/socialClient";
import type { Subject } from "@/lib/types";

const CLASSES = ["Class 11", "Class 12", "Dropper"];
const SUBJECTS: Subject[] = ["Physics", "Chemistry", "Maths"];

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [klass, setKlass] = useState("");
  const [weakSubject, setWeakSubject] = useState<Subject | "">("");
  const [touched, setTouched] = useState(false);

  // Returning-user mode: number only — profile comes back from the server.
  const [returning, setReturning] = useState(false);
  const [checking, setChecking] = useState(false);
  const [loginMsg, setLoginMsg] = useState("");

  const phoneDigits = phone.replace(/\D/g, "");
  const nameOk = name.trim().length >= 2;
  const phoneOk = phoneDigits.length === 10;
  const classOk = klass.length > 0;
  const subjectOk = weakSubject.length > 0;
  const valid = nameOk && phoneOk && classOk && subjectOk;

  function submit() {
    setTouched(true);
    if (!valid) return;
    saveAccount(name, phoneDigits, { klass, weakSubject: weakSubject as Subject });
    saveProfile(phoneDigits, name.trim(), klass, weakSubject).catch(() => {});
    router.replace("/");
  }

  async function loginWithNumber() {
    setTouched(true);
    setLoginMsg("");
    if (!phoneOk || checking) return;
    setChecking(true);
    try {
      const p = await lookupProfile(phoneDigits);
      if (p.exists && p.name) {
        const ws = SUBJECTS.includes(p.weakSubject as Subject) ? (p.weakSubject as Subject) : undefined;
        saveAccount(p.name, phoneDigits, { klass: p.klass, weakSubject: ws });
        router.replace("/");
        return;
      }
      setLoginMsg(
        p.configured
          ? "We couldn't find that number — sign up below, it takes 20 seconds."
          : "Couldn't reach the server — try again in a bit.",
      );
      if (p.configured) { setReturning(false); setTouched(false); }
    } catch {
      setLoginMsg("Couldn't reach the server — check your connection and try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className="flex min-h-[100dvh] flex-col px-6 pb-10 pt-16">
      {/* brand */}
      <div className="flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-violet)] text-3xl shadow-[var(--shadow-card)]">
          📄
        </div>
        <h1 className="mt-5 text-[2rem] font-extrabold leading-tight tracking-tight">
          let&apos;s get you in <span className="inline-block">👋</span>
        </h1>
        <p className="mt-1 text-[0.95rem] text-[var(--color-ink-soft)]">
          No password. No spam. Just your patterns. ✨
        </p>
      </div>

      {/* form */}
      <div className="mt-10 flex flex-col gap-4">
        {!returning && (
        <div>
          <label className="mb-1.5 block text-sm font-bold">What should we call you?</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="given-name"
            placeholder="Aarav"
            className="w-full rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] px-4 py-3.5 text-base font-medium outline-none focus:border-[var(--color-violet)]"
          />
          {touched && !nameOk && (
            <p className="mt-1 text-xs font-medium text-[var(--color-bad)]">Add your name (2+ letters).</p>
          )}
        </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-bold">Your number</label>
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] px-4 focus-within:border-[var(--color-violet)]">
            <span className="font-bold text-[var(--color-ink-soft)]">+91</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              inputMode="numeric"
              autoComplete="tel"
              placeholder="98765 43210"
              className="w-full bg-transparent py-3.5 text-base font-medium tracking-wide outline-none"
            />
          </div>
          {touched && !phoneOk && (
            <p className="mt-1 text-xs font-medium text-[var(--color-bad)]">Enter a 10-digit mobile number.</p>
          )}
        </div>

        {!returning && (
        <div>
          <label className="mb-1.5 block text-sm font-bold">Which class?</label>
          <div className="flex flex-wrap gap-2">
            {CLASSES.map((c) => (
              <button key={c} onClick={() => setKlass(c)} className="chip" data-on={klass === c}>{c}</button>
            ))}
          </div>
          {touched && !classOk && (
            <p className="mt-1 text-xs font-medium text-[var(--color-bad)]">Pick your class.</p>
          )}
        </div>
        )}

        {!returning && (
        <div>
          <label className="mb-1.5 block text-sm font-bold">Which subject is toughest for you?</label>
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map((s) => (
              <button key={s} onClick={() => setWeakSubject(s)} className="chip" data-on={weakSubject === s}>{s}</button>
            ))}
          </div>
          {touched && !subjectOk && (
            <p className="mt-1 text-xs font-medium text-[var(--color-bad)]">Pick the one you find hardest.</p>
          )}
        </div>
        )}

        {loginMsg && (
          <p className="text-center text-xs font-semibold text-[var(--color-violet-ink)]">{loginMsg}</p>
        )}
      </div>

      <div className="mt-auto pt-8">
        {returning ? (
          <button onClick={loginWithNumber} disabled={checking} className="btn btn-primary w-full text-base disabled:opacity-60">
            {checking ? "Finding your account…" : "Log me back in →"}
          </button>
        ) : (
          <button onClick={submit} disabled={touched && !valid} className="btn btn-primary w-full text-base">
            Start leveling up 🚀
          </button>
        )}
        <button
          onClick={() => { setReturning((r) => !r); setTouched(false); setLoginMsg(""); }}
          className="mt-3 w-full text-center text-sm font-bold text-[var(--color-violet)] underline underline-offset-2"
        >
          {returning ? "New here? Sign up" : "Already a user? Log in"}
        </button>
        <p className="mt-3 text-center text-xs text-[var(--color-ink-soft)]">
          Saved on your device. We&apos;ll never share it.
        </p>
      </div>
    </main>
  );
}
