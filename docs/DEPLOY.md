# NEYO — Deployment & DevOps Runbook (A.19)

This is the operations guide for shipping NEYO safely. It's written for a
beginner: follow it top to bottom. **Nothing here changes app code** — it's
GitHub/Vercel/Fly configuration plus a rollback procedure.

> **Architecture:** the **web app + API** run on **Vercel** (Next.js). The
> **background worker** (BullMQ queue drain — A.12 jobs, A.16 webhook retries)
> runs on **Fly.io**. The **database** is **Postgres** (e.g. Neon/Supabase/Fly
> Postgres); **Redis** (e.g. Upstash) backs the job queue.

---

## 0. One-time accounts you need

| Service | Why | Free tier? |
|---|---|---|
| GitHub | Source + CI/CD | Yes |
| Vercel | Web/API hosting | Yes |
| Fly.io | Worker hosting | Yes (card on file) |
| Neon / Supabase | Postgres database | Yes |
| Upstash | Redis (job queue) | Yes |

---

## 1. Continuous Integration (A.19.1) — already working

`.github/workflows/ci.yml` runs on **every pull request** and on pushes to
`main`. It:

1. Installs deps (`npm ci`)
2. Generates the Prisma client + **validates the schema**
3. Applies migrations to a throwaway CI database (`migrate:deploy`)
4. **Typechecks** (`npm run typecheck`)
5. Runs **role & isolation tests** (`npm run test:roles`)
6. Lints
7. **Builds** (`npm run build`)

If any step fails, the PR shows a red ✗ and (with branch protection on) can't
be merged. Nothing else is needed from you — it works as soon as the repo is on
GitHub.

---

## 2. Branch protection (A.19.4) — do this in GitHub settings

GitHub branch rules can't be set from code, so configure them once:

1. Push this project to a GitHub repo (the repo root **is** the `neyo` folder).
2. Go to **Settings → Branches → Add branch ruleset** (or "Add rule").
3. Branch name pattern: `main`.
4. Enable:
   - ✅ **Require a pull request before merging** (so nobody pushes straight to `main`).
   - ✅ **Require approvals** → 1 (uses `.github/CODEOWNERS`).
   - ✅ **Require status checks to pass before merging** → select **`CI / Typecheck, tests & build`**.
   - ✅ **Require branches to be up to date before merging**.
   - ✅ **Do not allow bypassing the above settings**.
5. Save.

Now: every change goes through a PR, CI must be green, and a reviewer must
approve. That's lines A.19.1 + A.19.4 satisfied.

---

## 3. Secrets to add (GitHub → Settings → Secrets and variables → Actions)

**Repository secrets:**

| Secret | Where to get it |
|---|---|
| `VERCEL_TOKEN` | https://vercel.com/account/tokens |
| `VERCEL_ORG_ID` | run `vercel link` locally → `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | same file |
| `PROD_DATABASE_URL` | your Postgres connection string (used to run migrations in CI deploy) |
| `FLY_API_TOKEN` | `fly tokens create deploy` |

**Repository variables** (turn deploys on once secrets exist):

| Variable | Value |
|---|---|
| `ENABLE_VERCEL_DEPLOY` | `true` |
| `ENABLE_FLY_DEPLOY` | `true` |

> The deploy workflows are **guarded by these variables** so the repo stays
> green before you've connected Vercel/Fly. Set them to `true` when ready.

**Runtime env (set in Vercel project + as Fly secrets):** `DATABASE_URL`,
`NEYO_MASTER_KEK`, `CRON_SECRET`, plus the "provide later" keys (Daraja, SMS,
Resend, R2, Redis, Sentry…). See `docs/CONTEXT-ANCHOR.md` for the full list.

---

## 4. Web deploy to Vercel (A.19.2)

`.github/workflows/deploy-web.yml` runs on push to `main` (once
`ENABLE_VERCEL_DEPLOY=true`):

1. Pulls the Vercel production env.
2. **Applies database migrations** (`migrate:deploy`) — see §6.
3. Builds with `vercel build --prod`.
4. Deploys the prebuilt output to production.

`vercel.json` also registers a **cron** that calls `/api/jobs/tick` every
minute (drives A.12 scheduled jobs + the A.16 webhook retry queue). The cron
authorizes with the `CRON_SECRET` env via `Authorization: Bearer <CRON_SECRET>`
(handled by the `GET /api/jobs/tick` route).

First-time setup: run `vercel link` once locally to create the project.

---

## 5. Worker deploy to Fly.io (A.19.3)

`.github/workflows/deploy-worker.yml` builds `Dockerfile.worker` and deploys to
Fly (once `ENABLE_FLY_DEPLOY=true`). The worker:

- Installs `bullmq` + `ioredis` (kept optional in the web app).
- Promotes `scripts/worker.ts.example` → `scripts/worker.ts` and runs it.
- Drains the `neyo-jobs` queue using `REDIS_URL`.

First-time setup:

```bash
fly launch --no-deploy            # creates the app from fly.toml
fly secrets set DATABASE_URL=... REDIS_URL=... NEYO_MASTER_KEK=...
fly deploy
```

> Until you provision Redis and set `REDIS_URL`, the app falls back to running
> jobs **in-process** (dev behaviour) — so the queue still works without the
> worker; the worker just makes it durable and scalable.

---

## 6. Database migrations — auto-applied (A.19.5)

- **Local dev:** `npm run prisma:migrate` (creates + applies a new migration to
  SQLite `prisma/dev.db`).
- **CI:** `migrate:deploy` runs against a throwaway DB to prove migrations apply
  cleanly.
- **Production:** `migrate:deploy` runs in the Vercel deploy job **before** the
  new build goes live (also wired into `vercel.json`'s `buildCommand`).
  `migrate deploy` only applies committed migrations and never resets data.

**Golden rule:** every schema change is a committed migration in
`prisma/migrations/`. Never edit the database by hand in production.

---

## 7. Rollback procedure (A.19.6)

When a deploy goes wrong, recover fast. Pick the layer that broke.

### A. Web/API (Vercel) — instant rollback (no code change)
1. Vercel dashboard → **Project → Deployments**.
2. Find the last known-good deployment → **⋯ → Promote to Production**.
   Traffic switches back in seconds.
   CLI: `vercel rollback <previous-deployment-url> --token=$VERCEL_TOKEN`.

### B. Worker (Fly.io)
1. `fly releases` — list releases for `neyo-worker`.
2. `fly deploy --image <previous-image-ref>` **or** `fly releases rollback`.

### C. Code (revert the change)
1. On GitHub, open the offending PR → **Revert**, or locally:
   ```bash
   git revert <bad-commit-sha>
   git push origin main
   ```
2. CI runs, then the deploy workflows ship the reverted code automatically.

### D. Database (the careful one)
Forward-only is safest. **Do not** blindly run `migrate reset` in production.
1. **Additive migrations (added a column/table):** usually safe to leave; just
   roll the app back (A/B above). The new column is simply unused.
2. **Destructive migration (dropped/renamed something):** restore from a
   backup snapshot taken before the deploy (Neon/Supabase keep point-in-time
   backups), then redeploy the previous app version.
3. Write a **new** forward migration to undo the change rather than deleting the
   bad migration file.

> **Always** snapshot the production DB before a deploy that includes a
> destructive migration (drop/rename/`@@unique` change).

### Post-incident
- Note what broke in the PR/issue.
- Add a test or CI check that would have caught it (keeps the gate honest).

---

## 8. Quick command reference

```bash
npm ci                 # clean install (CI)
npm run typecheck      # tsc --noEmit
npm run test:roles     # role + isolation tests
npm run build          # next build
npm run migrate:deploy # apply committed migrations (CI/prod)
npm run worker         # run the queue worker locally (needs Redis + bullmq)
```
