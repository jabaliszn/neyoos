import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { saveIntegrationCredential } from "../src/lib/services/integration-credentials.service";
import { getRedisQueueUrl, isRedisQueueConfigured } from "../src/lib/jobs/bullmq-adapter";
import { getScaleReadiness } from "../src/lib/services/scale-readiness.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const adapter = readFileSync(join(process.cwd(), "src/lib/jobs/bullmq-adapter.ts"), "utf8");
  const jobs = readFileSync(join(process.cwd(), "src/lib/jobs/jobs.service.ts"), "utf8");
  const worker = readFileSync(join(process.cwd(), "scripts/worker.ts"), "utf8");
  const health = readFileSync(join(process.cwd(), "src/lib/observability/health.ts"), "utf8");
  const scale = readFileSync(join(process.cwd(), "src/lib/services/scale-readiness.service.ts"), "utf8");
  const vault = readFileSync(join(process.cwd(), "src/lib/services/integration-credentials.service.ts"), "utf8");

  assert(adapter.includes("readCompanySecret") && adapter.includes("redis_url") && adapter.includes("getRedisQueueUrl"), "BullMQ adapter reads Redis URL from NEYO Ops vault");
  assert(jobs.includes("isRedisQueueConfigured") && jobs.includes("addToQueue"), "Job enqueue checks vault-aware Redis config before queueing");
  assert(worker.includes("getRedisQueueUrl") && worker.includes("WORKER_CONCURRENCY"), "Worker process reads Redis URL from vault/env and supports concurrency setting");
  assert(health.includes("isRedisQueueConfigured") && scale.includes("isRedisQueueConfigured"), "Health and scale-readiness checks use vault-aware Redis readiness");
  assert(vault.includes("redis_url"), "Integration vault includes Redis/Upstash URL credential");

  const actor = await db.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  assert(actor, "SUPER_ADMIN actor exists");
  const old = await db.neyoIntegrationSecret.findUnique({ where: { key: "redis_url" } }).catch(() => null);
  try {
    await db.neyoIntegrationSecret.deleteMany({ where: { key: "redis_url" } });
    assert(!(await isRedisQueueConfigured()) || Boolean(process.env.REDIS_URL), "Redis is not vault-configured before saving credential unless env is set");
    await saveIntegrationCredential(actor!, { key: "redis_url", value: "rediss://default:secret@upstash.example:6379" });
    assert(await isRedisQueueConfigured(), "Redis queue becomes configured after saving redis_url in NEYO Ops vault");
    assert((await getRedisQueueUrl()) === "rediss://default:secret@upstash.example:6379", "getRedisQueueUrl returns encrypted vault Redis URL");
    const readiness = await getScaleReadiness();
    const redis = readiness.checks.find((c) => c.key === "redis_queue");
    assert(redis?.status === "ready", "Scale readiness marks Redis queue ready from vault credential");
  } finally {
    await db.neyoIntegrationSecret.deleteMany({ where: { key: "redis_url" } });
    if (old) await db.neyoIntegrationSecret.create({ data: old as any });
  }

  console.log("\nI.60 Redis Worker from Vault test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => db.$disconnect());
