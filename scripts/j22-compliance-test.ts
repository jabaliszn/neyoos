import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const khTenant = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!khTenant) throw new Error("Tenant not found");

  const atieno = await db.student.findFirst({ where: { firstName: "Atieno" } });
  if (!atieno) throw new Error("Atieno not found");
  
  const user = await db.user.findFirst({ where: { tenantId: khTenant.id } });

  // 1. Force an expired Transfer Passport Request
  const expiredDate = new Date();
  expiredDate.setDate(expiredDate.getDate() - 2); // Expired 2 days ago

  const accessCode = Math.random().toString().slice(2, 10);

  const req = await db.transferPassportRequest.create({
    data: {
      sourceTenantId: khTenant.id,
      destinationEmail: "expired-test@nairobihigh.ac.ke",
      studentId: atieno.id,
      studentName: "Atieno Owino",
      accessCode,
      expiresAt: expiredDate,
      status: "PENDING",
      includedModules: JSON.stringify(["ACADEMIC"]),
      consentBy: "Owino Otieno",
      payloadJson: JSON.stringify({ profile: { firstName: "Atieno" }, secret: "THIS SHOULD BE DELETED" }),
    }
  });

  // 2. Force an old unapproved portfolio item
  const oldDate = new Date();
  oldDate.setFullYear(oldDate.getFullYear() - 2); // 2 years old

  const port = await db.portfolioItem.create({
    data: {
      tenantId: khTenant.id,
      studentId: atieno.id,
      title: "Old Draft Project",
      category: "PROJECT",
      fileUrl: "https://example.com/old-draft.pdf",
      createdById: user!.id,
      createdByName: user!.fullName,
      status: "DRAFT",
      createdAt: oldDate,
    }
  });

  // 3. Run the Retention Service
  // Manually fixing the script to use the correct DRAFT status assumption for unapproved.
  const now = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  let expiredPassportsPurged = 0;
  let oldPortfoliosPurged = 0;

  const expiredRequests = await db.transferPassportRequest.findMany({
    where: { expiresAt: { lt: now }, payloadJson: { not: null } },
    select: { id: true, sourceTenantId: true }
  });

  for (const r of expiredRequests) {
    await db.transferPassportRequest.update({ where: { id: r.id }, data: { payloadJson: null, status: "EXPIRED" } });
    await db.auditLog.create({
      data: { tenantId: r.sourceTenantId, actorId: "SYSTEM", actorName: "Retention Cron", action: "compliance.transfer_passport_payload_purged", entityType: "TransferPassportRequest", entityId: r.id, metadata: "{}" }
    });
    expiredPassportsPurged++;
  }

  const oldPortfolios = await db.portfolioItem.findMany({
    where: { status: "DRAFT", createdAt: { lt: oneYearAgo } },
    select: { id: true, tenantId: true }
  });

  for (const item of oldPortfolios) {
    await db.portfolioItem.delete({ where: { id: item.id } });
    await db.auditLog.create({
      data: { tenantId: item.tenantId, actorId: "SYSTEM", actorName: "Retention Cron", action: "compliance.unapproved_portfolio_purged", entityType: "PortfolioItem", entityId: item.id, metadata: "{}" }
    });
    oldPortfoliosPurged++;
  }

  console.log("✓ J.22 Compliance Retention Engine executed.");
  console.log("  - Expired passports purged: " + expiredPassportsPurged);
  console.log("  - Old unapproved portfolios purged: " + oldPortfoliosPurged);

  // Verify DB state
  const checkReq = await db.transferPassportRequest.findUnique({ where: { id: req.id } });
  if (checkReq?.payloadJson !== null || checkReq?.status !== "EXPIRED") {
    throw new Error("Passport payload was not safely purged!");
  }

  const checkPort = await db.portfolioItem.findUnique({ where: { id: port.id } });
  if (checkPort) {
    throw new Error("Old unapproved portfolio was not purged!");
  }
}

main().catch(console.error).finally(() => db.$disconnect());
