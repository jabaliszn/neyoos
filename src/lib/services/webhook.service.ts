/**
 * Webhook service (A.16.4 subscriptions, A.16.5 HMAC signing, A.16.6 retry).
 *
 * Flow:
 *  - A tenant registers a subscription (URL + events). We mint a signingSecret.
 *  - When something happens (e.g. a payment is recorded), code calls
 *    `dispatchEvent(tenantId, "payment.recorded", payload)`. For each matching
 *    active subscription we create a WebhookDelivery row (PENDING) and try once.
 *  - Failed deliveries are retried by the "webhook-deliver" background job
 *    (A.12) with exponential backoff via `nextAttemptAt`.
 *
 * Signature (A.16.5): X-NEYO-Signature: t=<unix>,v1=<hex hmac-sha256>
 *   signed message = `${t}.${rawBody}` with the subscription's signingSecret.
 *   Receivers recompute and compare in constant time, and reject stale t.
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { tenantDb } from "@/lib/core/tenant-db";
import { withTenant } from "@/lib/core/tenant-context";
import type {
  CreateWebhookInput,
  UpdateWebhookInput,
  WebhookEvent,
} from "@/lib/validations/api-keys";

export class WebhookError extends Error {
  constructor(public code: "NOT_FOUND", message: string) {
    super(message);
    this.name = "WebhookError";
  }
}

const MAX_ATTEMPTS = 6;
// Exponential backoff in seconds for attempts 1..6: 1m, 5m, 30m, 2h, 6h.
const BACKOFF_SEC = [0, 60, 300, 1800, 7200, 21600];
const DELIVERY_TIMEOUT_MS = 8000;

function newSigningSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

/** Compute the signature header value for a raw body. */
export function signPayload(
  rawBody: string,
  secret: string,
  timestamp = Math.floor(Date.now() / 1000)
): string {
  const sig = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return `t=${timestamp},v1=${sig}`;
}

/** Verify a received signature header (for our own /verify tooling + tests). */
export function verifySignature(
  rawBody: string,
  header: string,
  secret: string,
  toleranceSec = 300
): boolean {
  const parts = Object.fromEntries(
    header.split(",").map((kv) => kv.split("=") as [string, string])
  );
  const t = Number(parts.t);
  if (!t || Math.abs(Math.floor(Date.now() / 1000) - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret)
    .update(`${t}.${rawBody}`)
    .digest("hex");
  const got = parts.v1 ?? "";
  if (got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

// ---- subscription management (tenant-scoped) -------------------------------

export async function listWebhooks() {
  const rows = await tenantDb().webhookSubscription.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      deliveries: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  return rows.map((w) => ({
    id: w.id,
    url: w.url,
    events: safeParse(w.events),
    active: w.active,
    description: w.description,
    lastDeliveryAt: w.lastDeliveryAt,
    createdAt: w.createdAt,
    // signingSecret is sensitive but the tenant owner needs it to verify; show it.
    signingSecret: w.signingSecret,
    lastDeliveryStatus: w.deliveries[0]?.status ?? null,
  }));
}

export async function createWebhook(input: CreateWebhookInput) {
  return tenantDb().webhookSubscription.create({
    // tenantId auto-stamped by tenantDb() at runtime (A.2 isolation).
    data: {
      url: input.url,
      events: JSON.stringify(input.events ?? ["*"]),
      description: input.description ?? null,
      signingSecret: newSigningSecret(),
    } as never,
  });
}

export async function updateWebhook(id: string, input: UpdateWebhookInput) {
  const existing = await tenantDb().webhookSubscription.findUnique({ where: { id } });
  if (!existing) throw new WebhookError("NOT_FOUND", "Webhook not found.");
  return tenantDb().webhookSubscription.update({
    where: { id },
    data: {
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.events ? { events: JSON.stringify(input.events) } : {}),
      ...(input.url ? { url: input.url } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    },
  });
}

export async function deleteWebhook(id: string) {
  const existing = await tenantDb().webhookSubscription.findUnique({ where: { id } });
  if (!existing) throw new WebhookError("NOT_FOUND", "Webhook not found.");
  await tenantDb().webhookSubscription.delete({ where: { id } });
  return { id };
}

/** Send a test event to a single subscription (used by the dashboard "Send test"). */
export async function sendTestEvent(id: string) {
  const sub = await tenantDb().webhookSubscription.findUnique({ where: { id } });
  if (!sub) throw new WebhookError("NOT_FOUND", "Webhook not found.");
  const tenantId = sub.tenantId;
  const delivery = await db.webhookDelivery.create({
    data: {
      tenantId,
      subscriptionId: sub.id,
      event: "webhook.test",
      payload: JSON.stringify({
        event: "webhook.test",
        message: "This is a test event from NEYO.",
        createdAt: new Date().toISOString(),
      }),
      status: "PENDING",
      maxAttempts: MAX_ATTEMPTS,
      nextAttemptAt: new Date(),
    },
  });
  await attemptDelivery(delivery.id);
  return { deliveryId: delivery.id };
}

// ---- event dispatch (called by other services) -----------------------------

/**
 * Fan out an event to all matching active subscriptions for a tenant.
 * Creates a WebhookDelivery per subscription and tries each once immediately;
 * failures are picked up by the retry job.
 */
export async function dispatchEvent(
  tenantId: string,
  event: WebhookEvent | string,
  data: unknown
) {
  const subs = await db.webhookSubscription.findMany({
    where: { tenantId, active: true },
  });
  const matching = subs.filter((s) => {
    const evs = safeParse(s.events);
    return evs.includes("*") || evs.includes(event);
  });

  const body = JSON.stringify({
    event,
    data,
    createdAt: new Date().toISOString(),
  });

  for (const sub of matching) {
    const delivery = await db.webhookDelivery.create({
      data: {
        tenantId,
        subscriptionId: sub.id,
        event,
        payload: body,
        status: "PENDING",
        maxAttempts: MAX_ATTEMPTS,
        nextAttemptAt: new Date(),
      },
    });
    // Fire the first attempt without blocking the caller's request path.
    attemptDelivery(delivery.id).catch(() => {});
  }
  return { dispatched: matching.length };
}

/**
 * Attempt one delivery. On failure, schedule the next attempt with exponential
 * backoff, or mark FAILED once attempts are exhausted. Returns the new status.
 */
export async function attemptDelivery(deliveryId: string): Promise<string> {
  const delivery = await db.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { subscription: true },
  });
  if (!delivery || !delivery.subscription) return "GONE";
  if (delivery.status === "DELIVERED") return "DELIVERED";

  const attempt = delivery.attempts + 1;
  const signature = signPayload(delivery.payload, delivery.subscription.signingSecret);

  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let error: string | null = null;
  let ok = false;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
    const res = await fetch(delivery.subscription.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "NEYO-Webhooks/1.0",
        "X-NEYO-Event": delivery.event,
        "X-NEYO-Delivery": delivery.id,
        "X-NEYO-Signature": signature,
      },
      body: delivery.payload,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    responseStatus = res.status;
    responseBody = (await res.text().catch(() => "")).slice(0, 500);
    ok = res.status >= 200 && res.status < 300;
    if (!ok) error = `HTTP ${res.status}`;
  } catch (e) {
    error = (e as Error)?.message ?? "Request failed";
  }

  if (ok) {
    await db.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "DELIVERED",
        attempts: attempt,
        responseStatus,
        responseBody,
        error: null,
        deliveredAt: new Date(),
        nextAttemptAt: null,
      },
    });
    await db.webhookSubscription.update({
      where: { id: delivery.subscriptionId },
      data: { lastDeliveryAt: new Date() },
    });
    return "DELIVERED";
  }

  // Failure: retry with backoff, or give up.
  const exhausted = attempt >= delivery.maxAttempts;
  const backoff = BACKOFF_SEC[Math.min(attempt, BACKOFF_SEC.length - 1)];
  await db.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: exhausted ? "FAILED" : "PENDING",
      attempts: attempt,
      responseStatus,
      responseBody,
      error,
      nextAttemptAt: exhausted ? null : new Date(Date.now() + backoff * 1000),
    },
  });
  return exhausted ? "FAILED" : "PENDING";
}

/**
 * Retry job body (A.16.6 + A.12). Picks up to `limit` due PENDING deliveries
 * (nextAttemptAt <= now) across ALL tenants and re-attempts each. Returns a
 * summary the JobRun records.
 */
export async function retryDueDeliveries(limit = 50): Promise<{
  attempted: number;
  delivered: number;
  failed: number;
  pending: number;
}> {
  const due = await db.webhookDelivery.findMany({
    where: {
      status: "PENDING",
      nextAttemptAt: { lte: new Date() },
    },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
  });

  let delivered = 0;
  let failed = 0;
  let pending = 0;
  for (const d of due) {
    const status = await attemptDelivery(d.id);
    if (status === "DELIVERED") delivered++;
    else if (status === "FAILED") failed++;
    else pending++;
  }
  return { attempted: due.length, delivered, failed, pending };
}

function safeParse(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// Re-export withTenant for callers that need to wrap management calls.
export { withTenant };
