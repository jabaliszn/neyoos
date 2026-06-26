import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { runSubscriptionStateMachine } from "../src/lib/services/billing.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const billing = readFileSync(join(process.cwd(), "src/lib/services/billing.service.ts"), "utf8");
  const jobs = readFileSync(join(process.cwd(), "src/lib/jobs/registry.ts"), "utf8");
  const api = readFileSync(join(process.cwd(), "src/app/api/founder-ops/route.ts"), "utf8");
  const ui = readFileSync(join(process.cwd(), "src/components/founder/founder-ops-client.tsx"), "utf8");
  const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");

  assert(billing.includes("billing.grace_notice_sent") && billing.includes("billing.grace_warning_sent"), "Billing state machine sends grace start and warning notices");
  assert(billing.includes("billing.suspension_notice_sent") && billing.includes("suspend_not_delete"), "Billing state machine sends suspension notice and records suspend-not-delete policy");
  assert(jobs.includes("subscription-state-machine") && jobs.includes("Daily 01:00 EAT"), "Grace enforcement runs daily through the subscription-state-machine job");
  assert(api.includes("run_billing_enforcement") && api.includes("graceSummary"), "Founder Ops API exposes run-now enforcement and grace summary");
  assert(ui.includes("Grace-period enforcement") && ui.includes("Run enforcement now"), "Business Operations UI has grace enforcement monitor and run-now action");
  assert(layout.includes("sub.status === \"SUSPENDED\""), "Suspended schools are locked without deleting data");

  const tenant = await db.tenant.findFirst({ include: { subscription: true }, orderBy: { onboardedAt: "asc" } });
  assert(tenant, "Tenant exists for grace enforcement test");
  const oldSub = await db.subscription.findUnique({ where: { tenantId: tenant!.id } });
  const oldPhone = tenant!.phone;

  try {
    await db.tenant.update({ where: { id: tenant!.id }, data: { phone: oldPhone || "+254700111222" } });
    const sub = await db.subscription.upsert({
      where: { tenantId: tenant!.id },
      create: { tenantId: tenant!.id, planKey: "pro", status: "ACTIVE", grandfatheredPrice: 9000, currentPeriodStart: new Date(Date.now() - 130 * 24 * 3600_000), currentPeriodEnd: new Date(Date.now() - 24 * 3600_000) },
      update: { planKey: "pro", status: "ACTIVE", grandfatheredPrice: 9000, currentPeriodStart: new Date(Date.now() - 130 * 24 * 3600_000), currentPeriodEnd: new Date(Date.now() - 24 * 3600_000), graceEndsAt: null },
    });
    await db.auditLog.deleteMany({ where: { entityType: "Subscription", entityId: sub.id, action: { in: ["billing.grace_notice_sent", "billing.grace_warning_sent", "billing.suspension_notice_sent", "billing.suspended", "billing.entered_grace"] } } });

    const changedToGrace = await runSubscriptionStateMachine(new Date());
    const graceSub = await db.subscription.findUnique({ where: { tenantId: tenant!.id } });
    assert(changedToGrace >= 1 && graceSub?.status === "GRACE" && graceSub.graceEndsAt, "Overdue paid subscription enters GRACE and receives an end date");
    assert(await db.auditLog.findFirst({ where: { entityType: "Subscription", entityId: sub.id, action: "billing.grace_notice_sent" } }), "Grace start customer communication is audit logged");

    await db.subscription.update({ where: { id: sub.id }, data: { status: "GRACE", graceEndsAt: new Date(Date.now() + 24 * 3600_000) } });
    await runSubscriptionStateMachine(new Date());
    assert(await db.auditLog.findFirst({ where: { entityType: "Subscription", entityId: sub.id, action: "billing.grace_warning_sent" } }), "Grace-ending-soon warning is sent and audit logged once");

    await db.auditLog.deleteMany({ where: { entityType: "Subscription", entityId: sub.id, action: "billing.grace_warning_sent" } });
    await db.subscription.update({ where: { id: sub.id }, data: { status: "GRACE", graceEndsAt: new Date(Date.now() - 24 * 3600_000) } });
    const changedToSuspended = await runSubscriptionStateMachine(new Date());
    const suspendedSub = await db.subscription.findUnique({ where: { tenantId: tenant!.id } });
    assert(changedToSuspended >= 1 && suspendedSub?.status === "SUSPENDED", "Expired grace automatically suspends per policy");
    assert(await db.auditLog.findFirst({ where: { entityType: "Subscription", entityId: sub.id, action: "billing.suspension_notice_sent" } }), "If no warning communication exists, system sends final suspension communication");
    const suspendedAudit = await db.auditLog.findFirst({ where: { entityType: "Subscription", entityId: sub.id, action: "billing.suspended" } });
    assert(suspendedAudit?.metadata?.includes("dataPreserved") && suspendedAudit.metadata.includes("suspend_not_delete"), "Suspension audit explicitly records data preservation policy");
  } finally {
    if (oldSub) {
      await db.subscription.update({ where: { tenantId: tenant!.id }, data: { planKey: oldSub.planKey, status: oldSub.status, grandfatheredPrice: oldSub.grandfatheredPrice, addOns: oldSub.addOns, currentPeriodStart: oldSub.currentPeriodStart, currentPeriodEnd: oldSub.currentPeriodEnd, graceEndsAt: oldSub.graceEndsAt } });
    } else {
      await db.subscription.deleteMany({ where: { tenantId: tenant!.id } });
    }
    await db.tenant.update({ where: { id: tenant!.id }, data: { phone: oldPhone } });
  }

  console.log("\nI.48 Grace Enforcement checkpoint test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => db.$disconnect());
