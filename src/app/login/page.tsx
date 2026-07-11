"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveAccount } from "@/lib/store";
import { saveProfile } from "@/lib/socialClient";
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
      </div>

      <div className="mt-auto pt-8">
        <button onClick={submit} disabled={touched && !valid} className="btn btn-primary w-full text-base">
          Start leveling up 🚀
        </button>
        <p className="mt-3 text-center text-xs text-[var(--color-ink-soft)]">
          Saved on your device. We&apos;ll never share it.
        </p>
      </div>
    </main>
  );
}
