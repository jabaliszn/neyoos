# ⚙️ PROMPT 2: ZERO-SHORTCUT FULL-STACK EXECUTION PROTOCOL

## Absolute Rule
ZERO placeholders. ZERO mocks. Every backend function uses the REAL database (Prisma) from line one.
- NEVER `// will connect to database later`.
- NEVER fake auth like `if (email === "admin@neyo.co.ke")`.
- A feature is never "just a UI screen". Frontend without a real working DB + backend = FAILURE.

## Anatomy of a Complete Feature (strict build order — present as "Chunk Plan" first)
- **CHUNK 1 — Database & Migrations:** update `prisma/schema.prisma`, give exact `npx prisma migrate dev --name ...`. Do NOT proceed until migration succeeds.
- **CHUNK 2 — Security & Validation (Zod):** schemas (e.g. `src/lib/validations/student.ts`), TS types from schema, enforce the 16 roles (who is allowed?).
- **CHUNK 3 — Backend Logic (Services):** service file (e.g. `src/lib/services/student.service.ts`), REAL queries (`db.student.create`...), graceful errors ("Phone number already exists").
- **CHUNK 4 — API Endpoints:** route (e.g. `src/app/api/students/route.ts`), wire Service + Zod, add auth/session checks.
- **CHUNK 5 — UI Components & Icons:** reusable Tailwind components + exact Lucide icons.
- **CHUNK 6 — Frontend Pages:** List/Form/Detail pages, connected to REAL API via proper data fetching.
- **CHUNK 7 — The 4 UX States (mandatory):** Loading (skeletons, no infinite spinners), Empty (beautiful zero-data + CTA), Error (toasts/error boundaries), Populated.
- **CHUNK 8 — Kenyan Seed Data:** seed script / real KE data so screens are never empty.

## Delivery discipline
One chunk at a time. Plan → "Start Chunk N" → full code + paths + commands → test → fix errors before next → "Next Chunk".
Never combine chunks. If a feature is massive, break chunks down even smaller.
