/** A.16.6 live test: failure -> PENDING with backoff -> retry job re-attempts. */
import { db } from "../src/lib/db";
import { dispatchEvent, retryDueDeliveries } from "../src/lib/services/webhook.service";

async function main() {
  const tenant = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  // Dead endpoint (nothing listening on 4999).
  await db.webhookSubscription.updateMany({
    where: { tenantId: tenant.id },
    data: { url: "http://localhost:4999/dead", events: JSON.stringify(["*"]) },
  });
  await dispatchEvent(tenant.id, "payment.failed", { reason: "insufficient funds" });
  await new Promise((r) => setTimeout(r, 1200));
  let d = await db.webhookDelivery.findFirstOrThrow({
    where: { tenantId: tenant.id }, orderBy: { createdAt: "desc" },
  });
  console.log(`After 1st attempt: status=${d.status} attempts=${d.attempts} error=${d.error} nextAttemptAt=${d.nextAttemptAt?.toISOString()}`);

  // Force its nextAttemptAt into the past so the retry job picks it up now.
  await db.webhookDelivery.update({ where: { id: d.id }, data: { nextAttemptAt: new Date(Date.now() - 1000) } });
  const summary = await retryDueDeliveries();
  console.log("retryDueDeliveries ->", JSON.stringify(summary));
  d = await db.webhookDelivery.findUniqueOrThrow({ where: { id: d.id } });
  console.log(`After retry: status=${d.status} attempts=${d.attempts} nextAttemptAt=${d.nextAttemptAt?.toISOString()}`);

  // cleanup test deliveries + reset webhook url to sample
  await db.webhookDelivery.deleteMany({ where: { tenantId: tenant.id } });
  await db.webhookSubscription.updateMany({
    where: { tenantId: tenant.id },
    data: { url: "https://example.ac.ke/neyo/webhook", events: JSON.stringify(["payment.recorded","payment.failed"]) },
  });
  console.log("cleaned up test deliveries; webhook reset to sample url");
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
