# 🌅 PROMPT 3: VISUAL DESIGN, CONTINUITY & SOURCE OF TRUTH

## Complete Visual Styling (no half-measures)
- Frontend code = responsible for the ENTIRE visual design, every Tailwind class, stunning out-of-the-box.
- Strictly apply: Odoo structure (sidebars, top bars, breadcrumbs) + Apple craft (whitespace, rounded corners, soft shadows) + Linear speed.
- **LIQUID GLASS IS THE DEFAULT SYSTEM (2026-06-13):** every new surface must look right on glass-light AND glass-dark (test both). Never restyle a Tailwind utility that base-layer `@apply`s (circular-dependency build error — hit with bg-navy-950). Liquidity level = company-only (PlatformSetting `liquid_level`).
- **BUNDI COPY LAW:** never write the word "AI" in any UI copy — it is always "Bundi". The Bundi module stays platform-paused until founder launch signal; no feature may depend on it.
- Founder is a beginner — NO `/* add styling here */`. Deliver fully polished, production-ready UI in every frontend chunk.
- Every layout fully responsive, mobile-first 360px → desktop. Desktop screenshots at 1920×1080.

## Context Anchor System ("Save Game")
- When founder says **"Anchor"** (or end of session), output updated `docs/CONTEXT-ANCHOR.md` with:
  1. What we have built so far.
  2. Current database schema state.
  3. Exact folder paths of key files.
  4. What the NEXT feature is.
- Next chat: founder pastes Prompts 1/2/3 + CONTEXT-ANCHOR.md → resume instantly.

## Edit-Later Protocol (for a non-coder)
- End of every chunk → an **EDIT POINTS** list of human-readable change locations.
- Example: "To change headline text: `src/app/(marketing)/page.tsx` line 42."

## Source of Truth
- `docs/FEATURES-CHECKLIST.md` holds EVERY feature line as its own checkbox.
- Never build a feature not on the list. Build in logical order: Foundation → Student Mgmt → Attendance → Finance → etc.
- Tick the box `[x]` only when a feature is fully built full-stack (all relevant chunks) and testable.

## Standing operating procedure (per response)
1. Refer to these prompt files + CONTEXT-ANCHOR before continuing.
2. Build full-stack in all directions, up to the visuals.
3. Update FEATURES-CHECKLIST.md as features complete.
4. Founder tests in preview / externally and reports back; Build Partner owns feature follow-up.

## Engineering environment note
- Sandbox has Node 20 + npm 10, npm registry reachable. NO Postgres / Docker available here.
- DEV DB = **SQLite via Prisma** (file-based, zero-install) so the app is testable in preview TODAY.
- Schema is written to migrate cleanly to **Postgres (Neon)** for production. Postgres-only features (RLS, tsvector) are flagged where they apply and swapped in at deploy time.
