import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const khTenant = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!khTenant) throw new Error("Tenant not found");

  // 4. Test M.2 SMS Margins
  const { sendSms } = await import("../src/lib/notifications/sms");
  // Force a dummy send that triggers the tracking hook (using the proper options argument)
  await sendSms("+254711000000", "Testing M.2 Margins", { tenantId: khTenant.id });

  const margins = await db.smsMarginLedger.findMany({ where: { tenantId: khTenant.id } });
  console.log("✓ M.2 SMS Margins logged:", margins.length, "entries. Latest margin KES:", margins[0]?.marginKes);

}

main().catch(console.error).finally(() => db.$disconnect());
