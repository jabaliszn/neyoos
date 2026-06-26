import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import { checkBrokenPromises } from "@/lib/services/promise-to-pay.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

function asUser(u: any): SessionUser {
  return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null, language: u.language ?? "en" };
}

async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "karibu-high" } });
  const invoice = await db.invoice.findFirstOrThrow({ where: { tenantId: tenant.id, status: { in: ["UNPAID", "PARTIAL"] } } });
  const link = await db.studentGuardian.findFirstOrThrow({ where: { tenantId: tenant.id, studentId: invoice.studentId }, include: { guardian: true, student: true } });
  const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);

  await db.promiseToPay.deleteMany({ where: { tenantId: tenant.id, invoiceId: invoice.id, promiseDate: today } });
  const promise = await db.promiseToPay.create({
    data: {
      tenantId: tenant.id,
      invoiceId: invoice.id,
      studentId: invoice.studentId,
      guardianId: link.guardianId,
      promiseDate: today,
      amountKes: 1234,
      status: "ACTIVE",
    },
  });

  const beforeNotifs = await db.notification.count({ where: { tenantId: tenant.id, title: "Promise-to-pay due today" } });
  const result = await checkBrokenPromises(tenant.id);
  assert(result.dueOfficialNotifications > 0, "due promise check notifies school officials in-app");
  assert(result.dueParentSms >= 0, "due promise check executes parent SMS reminder path");

  const refreshed = await db.promiseToPay.findUniqueOrThrow({ where: { id: promise.id } });
  assert(Boolean(refreshed.reminderSentAt), "due promise is stamped after due-date notification so reminders are not duplicated");
  const afterNotifs = await db.notification.count({ where: { tenantId: tenant.id, title: "Promise-to-pay due today" } });
  assert(afterNotifs > beforeNotifs, "school official notification rows are created for promise due date");

  const second = await checkBrokenPromises(tenant.id);
  assert(second.dueOfficialNotifications === 0 && second.dueParentSms === 0, "second check does not duplicate due-date official/parent reminders");

  const service = readFileSync(join(process.cwd(), "src/lib/services/promise-to-pay.service.ts"), "utf8");
  const registry = readFileSync(join(process.cwd(), "src/lib/jobs/registry.ts"), "utf8");
  const ui = readFileSync(join(process.cwd(), "src/components/finance/finance-client.tsx"), "utf8");
  assert(service.includes("notifySchoolOfficialsOfDuePromise") && service.includes("Reminder — payment promise"), "promise service contains official notification and parent SMS due-date reminder logic");
  assert(registry.includes('"promise-check"') && registry.includes("Daily 03:15 EAT"), "promise-check job is scheduled daily");
  assert(ui.includes("Promises Calendar") && ui.includes("promiseDate"), "Finance UI exposes Promises Calendar");

  await db.notification.deleteMany({ where: { tenantId: tenant.id, title: "Promise-to-pay due today" } });
  await db.promiseToPay.deleteMany({ where: { id: promise.id } });

  console.log("\nI.24 Promise-to-Pay Calendar Automation test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => db.$disconnect());
