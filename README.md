# CheckMyPaper

**See _why_ you lose marks — not just what you got wrong.**

A student scans a coaching mock test, taps the questions they got wrong / guessed /
skipped, talks through how they approached each one, and the app builds a diagnostic
"fingerprint" of their mistake patterns that compounds across papers. JEE first.

This is the **v1 MVP** — the diagnostic loop only (chat, memes, and gamification are
deliberately deferred; see `/Users/pratyushsingh/.claude/plans/so-i-want-to-vivid-walrus.md`).

## The loop

1. **Add a paper** — snap photos or upload the PDF. A vision model reads each question and tags its topic.
2. **Triage** — tap the questions you got wrong, guessed, or skipped.
3. **Talk, topic by topic** — record your approach, then tap one chip for what tripped you up.
4. **Insight** — one honest sentence + where your marks went + one piece of advice.
5. **Progress** — your mistake mix and recurring weak topics, paper after paper.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. **It works with zero API keys** — it'll use a sample paper
and let you type your approach, so you can click through the whole loop immediately.
Use **"Try with a sample"** on the Add-a-paper screen.

## Turn on the real AI

Copy `.env.example` to `.env.local` and add:

- `DEEPSEEK_OCR_API_KEY` (+ `DEEPSEEK_OCR_BASE_URL`/`DEEPSEEK_OCR_MODEL`) — DeepSeek-OCR reads paper page images into text, via an OpenAI-compatible vision host (OpenRouter / Novita / DeepInfra). PDFs are rasterized to images in the browser first.
- `DEEPSEEK_API_KEY` — DeepSeek V4 Flash structures the OCR text into topic-tagged questions, and powers per-question diagnosis + the insight summary.
- `SARVAM_API_KEY` — Sarvam AI speech-to-text for the voice narration (strong on Hindi/English code-mixing). Falls back to `TRANSCRIBE_API_KEY` (OpenAI-compatible Whisper) if Sarvam isn't set.

## Rotating API keys

Keys live as Vercel **encrypted env vars** (production) and in local `.env.local`.
Env changes only take effect on a **new deployment**.

**OpenRouter key** is used by three vars: `DEEPSEEK_API_KEY`, `DEEPSEEK_OCR_API_KEY`,
`VISUAL_API_KEY`. **Sarvam key** is one var: `SARVAM_API_KEY`.

1. Create the new key (OpenRouter: https://openrouter.ai/keys · Sarvam: https://dashboard.sarvam.ai).
2. Update on Vercel — Dashboard → project **checkmypaper** → Settings → Environment
   Variables → edit each var → Save. Or via CLI, e.g. for the OpenRouter key:
   ```bash
   for V in DEEPSEEK_API_KEY DEEPSEEK_OCR_API_KEY VISUAL_API_KEY; do
     vercel env rm $V production -y
     printf '%s' "NEW_OPENROUTER_KEY" | vercel env add $V production
   done
   # Sarvam:
   vercel env rm SARVAM_API_KEY production -y
   printf '%s' "NEW_SARVAM_KEY" | vercel env add SARVAM_API_KEY production
   ```
3. Update the same lines in local `.env.local`.
4. Redeploy: `vercel --prod` (required for changes to go live).
5. **Revoke the old key** in the provider dashboard.

## Architecture (v1)

- **Local-first store** (`src/lib/store.ts`) — papers, questions, attempts, and the
  learner-profile "fingerprint" live in the browser (`localStorage`). Matches the
  PRD's "device caches the student's data" principle.
- **Server AI routes** (`src/app/api/*`) — `extract`, `transcribe`, `diagnose`,
  `insight`. Each degrades gracefully to a realistic mock when its key is absent.
- **PWA** — installable on Android (manifest + service worker), no Play Store needed.

## Next: cloud sync + auth

`supabase/migrations/0001_init.sql` has the cloud schema (Postgres + pgvector + RLS)
for when you want cross-device sync and phone-OTP login. The local store maps 1:1 to it.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind v4 · DeepSeek (OCR + V4 Flash) · Sarvam AI (voice) · TypeScript.
