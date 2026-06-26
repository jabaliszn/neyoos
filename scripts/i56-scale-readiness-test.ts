import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getScaleReadiness } from "../src/lib/services/scale-readiness.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const doc = readFileSync(join(process.cwd(), "docs/NEYO-SCALE-2M-ARCHITECTURE.md"), "utf8");
  const service = readFileSync(join(process.cwd(), "src/lib/services/scale-readiness.service.ts"), "utf8");
  const api = readFileSync(join(process.cwd(), "src/app/api/admin/scale-readiness/route.ts"), "utf8");
  const deploy = readFileSync(join(process.cwd(), "docs/DEPLOY.md"), "utf8");

  assert(doc.includes("2,000,000 Active Users") && doc.includes("Neon Postgres") && doc.includes("Redis") && doc.includes("R2/S3"), "2M architecture document covers Postgres, Redis and object storage");
  assert(doc.includes("Production readiness gates") && doc.includes("load test"), "2M architecture document defines readiness gates and load testing");
  assert(service.includes("database_postgres") && service.includes("database_pooling") && service.includes("redis_queue") && service.includes("object_storage"), "Scale readiness service checks DB, pooling, Redis and object storage");
  assert(service.includes("encrypted_uploads") && service.includes("observability") && service.includes("cron_secret"), "Scale readiness service checks encrypted uploads, observability and cron protection");
  assert(api.includes("requireRole(\"SUPER_ADMIN\")") && api.includes("getScaleReadiness"), "Scale readiness API is SUPER_ADMIN-gated");
  assert(deploy.includes("Postgres") && deploy.includes("Redis") && deploy.includes("Vercel") && deploy.includes("Fly"), "Deployment runbook already documents production hosting/worker path");

  const readiness = await getScaleReadiness();
  assert(readiness.target === "2,000,000 active users", "Scale readiness result targets 2M active users");
  assert(Array.isArray(readiness.checks) && readiness.checks.length >= 8, "Scale readiness returns multiple infrastructure checks");
  assert(readiness.checks.some((c) => c.key === "encrypted_uploads" && c.status === "ready"), "Encrypted upload hardening is marked ready");
  assert(readiness.checks.some((c) => c.key === "database_postgres"), "Readiness includes production Postgres check");

  console.log("\nI.56 Scale Readiness test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); });
