import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { createCustomerThread, addCustomerThreadMessage, updateCustomerThreadStatus } from "../src/lib/services/neyo-customer-hub.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
  const migration = readFileSync(join(process.cwd(), "prisma/migrations/20260624161000_i48_customer_neyo_hub/migration.sql"), "utf8");
  const service = readFileSync(join(process.cwd(), "src/lib/services/neyo-customer-hub.service.ts"), "utf8");
  const api = readFileSync(join(process.cwd(), "src/app/api/founder-ops/route.ts"), "utf8");
  const supportApi = readFileSync(join(process.cwd(), "src/app/api/neyo-support/route.ts"), "utf8");
  const founderUi = readFileSync(join(process.cwd(), "src/components/founder/founder-ops-client.tsx"), "utf8");
  const billingUi = readFileSync(join(process.cwd(), "src/components/settings/billing-manager.tsx"), "utf8");

  assert(schema.includes("model NeyoCustomerThread") && schema.includes("model NeyoCustomerMessage"), "Database has customer thread/message models");
  assert(migration.includes("CREATE TABLE \"NeyoCustomerThread\"") && migration.includes("CREATE TABLE \"NeyoCustomerMessage\""), "Migration creates customer hub tables");
  assert(service.includes("createCustomerThread") && service.includes("addCustomerThreadMessage"), "Service creates and replies to customer threads");
  assert(api.includes("reply_customer_thread") && api.includes("customerThreads"), "Founder Ops API returns and replies to customer threads");
  assert(supportApi.includes("create_thread") && supportApi.includes("listSchoolCustomerThreads"), "School-facing NEYO support API exists");
  assert(founderUi.includes("Customer ↔ NEYO Communication Hub") && founderUi.includes("Reply"), "NEYO Ops UI has customer communication hub");
  assert(billingUi.includes("Contact NEYO about billing or your account") && billingUi.includes("/api/neyo-support"), "School Billing UI can contact NEYO");

  const user = await db.user.findFirst({ where: { role: "PRINCIPAL" } }) || await db.user.findFirst();
  const superAdmin = await db.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  assert(user && superAdmin, "School user and SUPER_ADMIN exist");

  const thread = await createCustomerThread(user as any, { subject: "Need help with renewal", body: "Please confirm our renewal and SMS top-up options.", priority: "HIGH", source: "SCHOOL_OS" });
  assert(thread?.status === "WAITING_ON_NEYO" && thread.messages.length === 1, "School creates a thread waiting on NEYO with first message");

  const reply = await addCustomerThreadMessage({ id: superAdmin!.id, fullName: superAdmin!.fullName, role: superAdmin!.role, tenantId: superAdmin!.tenantId }, { threadId: thread!.id, body: "We have received this and will assist.", direction: "NEYO", channel: "IN_APP" });
  assert(reply.direction === "NEYO", "NEYO can reply inside the hub");
  const afterReply = await db.neyoCustomerThread.findUnique({ where: { id: thread!.id } });
  assert(afterReply?.status === "WAITING_ON_CUSTOMER", "NEYO reply moves thread to waiting on customer");

  const resolved = await updateCustomerThreadStatus({ id: superAdmin!.id, fullName: superAdmin!.fullName, tenantId: superAdmin!.tenantId }, { threadId: thread!.id, status: "RESOLVED", priority: "NORMAL" });
  assert(resolved.status === "RESOLVED" && resolved.priority === "NORMAL", "NEYO can resolve and reprioritize a customer thread");

  const audits = await db.auditLog.findMany({ where: { entityType: "NeyoCustomerThread", entityId: thread!.id } });
  assert(audits.some((a) => a.action === "platform.customer_thread_created") && audits.some((a) => a.action === "platform.customer_thread_replied") && audits.some((a) => a.action === "platform.customer_thread_status_updated"), "Customer hub actions are audit logged");

  await db.neyoCustomerThread.delete({ where: { id: thread!.id } });
  console.log("\nI.48 Customer ↔ NEYO Communication Hub checkpoint test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => db.$disconnect());
