# NEYO Scale Architecture — 2,000,000 Active Users

Updated: 2026-06-25

## 1. Short answer

Yes, NEYO can scale to 2,000,000 active users if production is operated with the correct infrastructure.

The current codebase is designed around the right principles:

- stateless Next.js app/API;
- tenant-scoped data model;
- Prisma service layer;
- Postgres production path;
- background job registry;
- optional Redis/BullMQ queue;
- object storage abstraction;
- audit logs;
- role/permission isolation;
- encrypted storage vault;
- central billing callbacks;
- health checks.

But SQLite/dev mode cannot serve 2M users. The 2M target requires the production checklist below.

## 2. Production architecture

```txt
Users / schools / parents / teachers
        ↓
CDN / edge caching / static assets
        ↓
Stateless Next.js web + API nodes
        ↓
Neon Postgres with pooling + read replicas
        ↓
Redis queue/cache/rate-limit layer
        ↓
Workers for jobs, reminders, webhooks, storage checks
        ↓
R2/S3 encrypted object storage
        ↓
SMS / Email / WhatsApp / Daraja / YouTube / Google Workspace connectors
```

## 3. Required production components

| Layer | Required for 2M? | Recommended |
|---|---:|---|
| App hosting | Yes | Vercel/Fly/Kubernetes, stateless horizontal scale |
| Database | Yes | Neon Postgres or equivalent managed Postgres |
| Connection pooling | Yes | Neon pooled connection string or PgBouncer |
| Read replicas | Yes at scale | analytics/report reads off primary |
| Redis | Yes | Upstash/Redis Cloud for queues, rate-limit, cache |
| Workers | Yes | Fly.io/Render/K8s workers draining queue |
| Object storage | Yes | R2/S3-compatible, encrypted blobs |
| CDN | Yes | Vercel/Cloudflare for assets and public files |
| Observability | Yes | Sentry + Better Stack + PostHog/log analytics |
| Backups | Yes | PITR Postgres, object versioning, tested restore |
| Load testing | Yes | k6/Artillery before launch campaigns |

## 4. Database hardening

The production database must be Postgres.

Required:

- connection pooling;
- query indexes on tenant/status/date fields;
- slow query logging;
- point-in-time recovery;
- migration discipline;
- backup restore test;
- read replicas for reporting;
- no destructive migrations without snapshot;
- Postgres RLS policies applied where applicable.

Current schema already has many tenant indexes. Continue adding indexes when a query filters by:

```txt
tenantId + date/status/entityId
```

## 5. App hardening

The app must remain stateless.

Do not store important runtime state in memory.

Good:

- session token in database;
- jobs in Redis;
- files in object storage;
- notifications in database;
- audit logs in database;
- feature flags in database.

Bad:

- long-running memory-only queues;
- local file storage in production;
- per-server global state;
- assuming one server instance.

## 6. Queue/job hardening

At 2M users, background work cannot run only inside the web request.

Move these to queue/worker:

- SMS broadcasts;
- fee reminders;
- promise checks;
- storage health checks;
- webhooks;
- PDF batch generation;
- report packs;
- notification digests;
- imports;
- large exports;
- YouTube/search sync;
- Google Workspace provisioning.

The app already has a job registry. Production must set:

```txt
REDIS_URL
```

and run a worker.

## 7. Storage hardening

At 2M users, storage must use external object storage.

Required:

- R2/S3-compatible provider;
- encryption before provider upload;
- object versioning where possible;
- lifecycle/retention policies;
- quota bar and upgrade flow;
- provider health checks;
- no plaintext direct-upload path.

The Storage Vault work now supports encrypted uploads and provider health seams.

## 8. Caching strategy

Cache only safe data.

Safe examples:

- public landing page content;
- public school page data;
- module/feature flag reads;
- static lookup lists;
- dashboard aggregate snapshots;
- term pulse snapshots.

Do not cache sensitive data without tenant-aware keys and invalidation.

Cache keys must include:

```txt
tenantId
role/user when needed
feature/version
```

## 9. Observability

For scale, NEYO needs:

- `/api/health` uptime monitoring;
- error capture;
- structured logs;
- performance traces;
- job failure alerts;
- DB latency alerts;
- storage provider alerts;
- payment callback alerts;
- SMS/email delivery alerts.

Minimum production stack:

```txt
Sentry → exceptions
Better Stack / Logtail → logs + uptime
PostHog or equivalent → product usage analytics
```

No secrets should be logged.

## 10. Rate limiting and abuse protection

At scale, protect:

- login OTP;
- password login;
- public waitlist;
- public payments;
- file uploads;
- API keys;
- webhooks;
- search endpoints;
- YouTube search;
- exports.

Use Redis-backed limits in production.

## 11. File and PDF generation

PDFs and bulk documents can be heavy.

Rules:

- small single PDFs can render on request;
- bulk PDFs should be queued;
- long exports should become background jobs;
- store generated output in encrypted storage;
- notify user when ready.

## 12. Multi-tenant data safety

The most important scale rule is isolation.

Every query must respect tenant scope unless the action is company-level SUPER_ADMIN in NEYO Ops.

At 2M users, a single tenant leak is a company-level incident.

Keep:

- role tests;
- tenant isolation tests;
- audit logs;
- impersonation logs;
- admin-only cross-tenant APIs.

## 13. Load testing plan

Before major launch:

1. Seed realistic tenants/users.
2. Run smoke tests.
3. Run k6/Artillery load test.
4. Test login, dashboard, payments, attendance, finance, messaging.
5. Watch DB CPU, connection count, p95 latency and error rate.
6. Test queue under fee-reminder/broadcast load.
7. Test object storage upload/download.
8. Test rollback.

Target starting SLO:

```txt
p95 API latency under normal load: < 500ms
p95 critical write latency: < 900ms
error rate: < 1%
uptime target: 99.9%+
```

## 14. 2M-user readiness stages

### Stage 1 — 100 schools

- Vercel + Neon pooled Postgres;
- R2 storage;
- Redis queue;
- Better Stack uptime;
- Sentry;
- weekly backup restore drill.

### Stage 2 — 1,000 schools

- read replicas;
- query review;
- broadcast queue fan-out;
- storage health automation;
- support inbox triage;
- per-tenant usage dashboards.

### Stage 3 — 10,000+ schools / 2M users

- multi-region CDN;
- database read replicas;
- background worker fleet;
- data warehouse for analytics;
- formal incident process;
- support SLA tooling;
- cost observability;
- dedicated DevOps ownership.

## 15. Production readiness gates

Do not claim 2M readiness until these are green:

- Postgres production DB with pooling;
- Redis configured;
- object storage configured;
- encrypted upload path active;
- legacy direct uploads locked;
- job worker running;
- health endpoint monitored;
- Sentry/logging configured;
- backup restore tested;
- load test completed;
- role/tenant tests pass;
- payment callback tested;
- storage quota health job tested.

## 16. Current conclusion

The codebase is on the right path and has been hardened for scale in architecture.

The remaining work is production infrastructure activation:

- replace SQLite with Neon Postgres;
- set pooled `DATABASE_URL`;
- configure Redis;
- run worker;
- configure R2/S3;
- enable observability;
- run load tests;
- document restore drills.

This is realistic for the 100-school 2027 target and can grow toward 2M users with disciplined infrastructure.
