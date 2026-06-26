/** A.16 live test: webhook dispatch + HMAC signing + delivery record. */
import { db } from "../src/lib/db";
import { dispatchEvent } from "../src/lib/services/webhook.service";

async function main() {
  const tenant = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  await db.webhookSubscription.updateMany({
    where: { tenantId: tenant.id },
    data: { url: "http://localhost:4555/hook", events: JSON.stringify(["*"]) },
  });
  console.log("Dispatching payment.recorded ...");
  const r = await dispatchEvent(tenant.id, "payment.recorded", {
    amount: 5000, currency: "KES", student: "Achieng Mary",
  });
  console.log("dispatch ->", JSON.stringify(r));
  await new Promise((res) => setTimeout(res, 1800));
  const deliveries = await db.webhookDelivery.findMany({
    where: { tenantId: tenant.id }, orderBy: { createdAt: "desc" }, take: 3,
  });
  for (const d of deliveries) {
    console.log(`delivery ${d.id.slice(0,8)} event=${d.event} status=${d.status} attempts=${d.attempts} responseStatus=${d.responseStatus} error=${d.error ?? "-"}`);
  }
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
