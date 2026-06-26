/**
 * BullMQ adapter (Feature A.12) — PRODUCTION path.
 * Reads Redis/Upstash URL from the encrypted NEYO Ops Integration Credential
 * Vault (`redis_url`) with REDIS_URL env fallback. Pushes jobs to a Redis-backed
 * queue that a separate worker drains.
 */
import { readCompanySecret } from "@/lib/services/company-secret.service";

export async function getRedisQueueUrl(): Promise<string | null> {
  return (await readCompanySecret("redis_url")) || process.env.REDIS_URL || null;
}

export async function isRedisQueueConfigured(): Promise<boolean> {
  return Boolean(await getRedisQueueUrl());
}

export async function addToQueue(name: string, payload?: unknown): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let BullMQ: any;
  try {
    // Opaque dynamic import so webpack doesn't try to resolve the optional
    // 'bullmq' package at build time (it's installed only in production).
    const moduleName = "bullmq";
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const dynamicImport = new Function("m", "return import(m)") as (
      m: string
    ) => Promise<unknown>;
    BullMQ = await dynamicImport(moduleName);
  } catch {
    throw new Error(
      "bullmq is not installed. Run `npm i bullmq ioredis` to enable the Redis queue."
    );
  }
  const { Queue } = BullMQ as { Queue: new (n: string, o: unknown) => { add: (...a: unknown[]) => Promise<unknown>; close: () => Promise<void> } };
  const redisUrl = await getRedisQueueUrl();
  if (!redisUrl) throw new Error("Redis queue URL is not configured. Save redis_url in NEYO Ops Integration Credential Vault.");
  const queue = new Queue("neyo-jobs", {
    connection: { url: redisUrl },
  });
  await queue.add(
    name,
    { name, payload },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    }
  );
  await queue.close();
}
