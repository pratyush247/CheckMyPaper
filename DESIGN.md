# DESIGN.md: Google Antigravity → CheckMyPaper "Liftoff"

## Source
- URL: https://antigravity.google/
- Capture date: 2026-07-07
- Evidence: Playwright full-page screenshot + live `getComputedStyle` token dump (Firecrawl was IP-blocked without a key, so the site was captured directly in a real browser)

## Reference Screenshot
![Full-page screenshot of antigravity.google](./antigravity-full.png)

Visual source of truth for layout, density, and feel. Tokens below describe the
same language in machine-readable form.

## Design Summary
Agentic, monochrome, minimal. A near-white surface with near-black ink, a
Material-3 grey ramp for hierarchy, hairline outlines, and **one** restrained
blue accent (`#3279F9`) used sparingly. Large, light-weight display type with
tight negative tracking. Pill-shaped actions — a solid near-black primary
("Download"), a quiet translucent-grey secondary. Generous whitespace, soft
large-radius cards, near-flat shadows. Calm and confident, not decorative.

## Design Tokens

### Colors (observed from `:root`)
| Role | Light | Dark |
|---|---|---|
| Surface (card) | `#FFFFFF` | `#17191D` |
| Canvas (container) | `#F6F7F9` | `#0E0F12` |
| On-surface (ink) | `#121317` | `#F0F1F5` |
| On-surface-variant | `#45474D` / `#5B5E66` | `#9AA0AC` |
| Outline (hairline) | `rgba(18,19,23,.06–.12)` | `rgba(255,255,255,.08)` |
| Accent (blue) | `#3279F9` | `#5B95FF` |

Antigravity is otherwise strictly monochrome; the grey ramp (`grey-0…1200`)
does all the hierarchy work.

### Typography
- Family: **Google Sans Flex** → fallback to any clean geometric sans (this app
  uses Plus Jakarta Sans for both body and display).
- Display weight **~450–550** (light), letter-spacing **-0.02 to -0.03em**.
- Big type scale: hero ~80–107px; a full `--{sm…9xl}` ramp with tightening
  tracking as size grows.

### Spacing, Shape, Motion
- Space scale: `4 · 8 · 16 · 24 · 36 · 48 · 60 · 80 · 88 · 120 · 180`. Page margin 72px.
- Corners: `xs 4 · sm 8 · md 16 · lg 24 · xl 36 · rounded 9999`.
- Shadows near-flat; hierarchy comes from hairline outlines + surface tint, not elevation.
- Rich easing library; entrances favour `ease-out-expo` / `ease-out-quint`, playful pops use `ease-out-back`.

## Components
- **Primary button** — solid `on-surface` (near-black) pill, `surface` text. Inverts in dark (near-white pill, dark text).
- **Secondary button** — translucent grey pill (`rgba(grey,.1)`), ink text.
- **Cards** — `surface` bg, hairline outline, large radius, minimal shadow.
- **Nav** — 52px bar, wordmark left, dark pill CTA right; active = ink, inactive = grey.

## How it was applied here (no page/logic changes)
The whole app already re-skins through `src/app/globals.css` (Tailwind v4
`@theme` tokens + a `@layer components` block). Only three files changed:
- **`globals.css`** — repointed the palette to the monochrome + blue-accent ramp
  above; primary button → solid ink pill (auto-inverting via `--color-ink` bg /
  `--color-card` text); secondary → translucent grey; rainbow `.tile-*` candy →
  calm tonal surfaces with hairline borders; softened glow, shadows, and heading
  weight/tracking. `--color-violet` kept as the token name but is now the blue accent.
- **`layout.tsx`** — dropped the playful Fredoka display font (display now uses
  the geometric Jakarta); theme-color → `#f6f7f9`.
- **`BottomNav.tsx`** — removed a hardcoded `text-white` on the mic FAB so it
  inherits the inverting primary color (white icon in light, dark in dark).

Result verified in-browser, light + dark: `checkmypaper-lightmode.png`, `checkmypaper-light.png`.

## Rerun Inputs
workflow: firecrawl-website-design-clone
source_url: https://antigravity.google/
target_stack: Next.js 16 + Tailwind v4 (token-driven re-skin)
output: DESIGN.md
