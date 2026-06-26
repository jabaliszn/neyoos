# NEYO — Brand & Design System (A.20)

The single source of visual truth. The live, interactive version is the
**`/brand`** page in the app (sign in → sidebar → Brand). This file documents the
fixed assets and tokens so they survive outside the app.

## Design DNA

- **Odoo** for structure (top bar + left sidebar + breadcrumbs + list/form views).
- **Apple** for craft (calm whitespace, Inter, one primary CTA per screen, soft
  shadows, `rounded-2xl` cards, `rounded-full` buttons, 200ms `ease-apple`).
- **Linear** for clarity (deliberate status pills, dark mode, zero clutter,
  keyboard shortcuts, optimistic UI).
- **Anti-AI restraint:** no gradient soup, no generic marketing copy, no bouncy
  animations, no emoji bento grids.

## Colour tokens (Tailwind — `tailwind.config.ts`)

| Token | Use | Key shade |
|---|---|---|
| `navy` | structure, text, headers | `navy-900` #1c2740 |
| `green` | growth, success, the ONE primary CTA | `green-500` #1f9d5f |
| `warm` | calm app background | `warm-100` #faf8f2 |
| `status.present/absent/late/excused` | attendance pills | green/red/amber/blue |

> **Rule:** no raw hex in components — always a Tailwind token.

## Type & motion

- **Font:** Inter (system fallback stack).
- **Radius:** `2xl` = 1rem (cards), `full` (buttons/pills).
- **Shadow:** `shadow-card` (soft, brand-tinted — never harsh black).
- **Motion:** `ease-apple` = `cubic-bezier(0.32, 0.72, 0, 1)`, ~200ms.

## Logo

- **`<NeyoLogo />`** (`src/components/brand/neyo-logo.tsx`) — inline SVG, renders
  everywhere incl. the sandboxed preview. Variants: `full` | `mark` | `wordmark`.
  The wordmark uses `currentColor`, so it adapts to light/dark via text colour.
- Used in the topbar (mark) and the login screen (mark).
- **Raster lockups** for email/slides/external use:
  `public/brand/wordmark-light.png` and `public/brand/wordmark-dark.png`.

## Icons & favicon

| File | Use |
|---|---|
| `public/favicon.ico` | browser tab (16/32/48 multi-size) |
| `public/favicon-32.png`, `favicon-16.png` | PNG favicons |
| `public/icon-192.png`, `icon-512.png` | PWA (manifest) |
| `public/apple-touch-icon.png` | iOS home screen |
| `public/brand/icon.png` | 256px standalone mark |

Wired in `src/app/layout.tsx` (`metadata.icons`) and `manifest.webmanifest`.

## Mascot — Bundi

`public/brand/bundi-mascot.png`. A calm, scholarly owl (*bundi* = owl in
Swahili), navy with a green graduation-cap accent. Use in empty states,
onboarding and celebratory moments. Never loud.

## Brand pattern

`public/brand/pattern-tile.png` — a subtle, seamless watermark for login/empty
backgrounds. Tile at ~320px, low contrast.

## Component library (`src/components/ui/`)

Button, Card, Input, Label, Badge, **Table** (+ TableContainer/THead/TBody/TR/
TH/TD), EmptyState, StatCard, Skeleton, Toast, Toggle, OtpInput, PasswordInput,
SlugField, FileUpload, ExportMenu. All are dark-mode aware and use the tokens
above. See them rendered on `/brand`.

## Cultural moments

`src/lib/i18n/cultural-calendar.ts` → `KE_MOMENTS` (Kenyan public holidays +
academic windows + religious dates). Powers reminders (A.7), the shared calendar
(A.17) and is shown as a lookup table on `/brand`.

## EDIT POINTS

- Brand colours / radius / motion → `tailwind.config.ts` (top of file).
- Logo shape → `src/components/brand/neyo-logo.tsx`.
- Regenerate raster assets (mascot/wordmarks/pattern/favicon) → see the asset
  files in `public/brand/` and `public/`.
