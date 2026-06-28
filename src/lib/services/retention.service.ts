import { db } from "@/lib/db";

/**
 * J.22 Compliance & Data Retention Engine.
 * Runs on a cron to automatically purge expired PII and transfer passport payloads
 * minimizing NEYO's liability under ODPC/GDPR.
 */
export async function enforceDataRetentionPolicies() {
  const now = new Date();
  
  let expiredPassportsPurged = 0;
  let oldPortfoliosPurged = 0;

  // 1. Purge expired Transfer Passport payloads (minimization)
  // We keep the log record, but wipe the highly sensitive payloadJson.
  const expiredRequests = await db.transferPassportRequest.findMany({
    where: { 
      expiresAt: { lt: now },
      payloadJson: { not: null }
    },
    select: { id: true, sourceTenantId: true }
  });

  for (const req of expiredRequests) {
    await db.transferPassportRequest.update({
      where: { id: req.id },
      data: { 
        payloadJson: null, 
        status: "EXPIRED" 
      }
    });

    await db.auditLog.create({
      data: {
        tenantId: req.sourceTenantId,
        actorId: "SYSTEM",
        actorName: "Retention Cron",
        action: "compliance.transfer_passport_payload_purged",
        entityType: "TransferPassportRequest",
        entityId: req.id,
        metadata: JSON.stringify({ reason: "Access period expired" })
      }
    });
    
    expiredPassportsPurged++;
  }

  // 2. Soft-delete old unapproved portfolio items (e.g., > 1 year old) to save storage
  // (In a real system we would actually tell the StorageVault to delete the S3 object)
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const oldPortfolios = await db.portfolioItem.findMany({
    where: {
      status: "DRAFT",
      createdAt: { lt: oneYearAgo }
    },
    select: { id: true, tenantId: true }
  });

  for (const item of oldPortfolios) {
    await db.portfolioItem.delete({ where: { id: item.id } });
    
    await db.auditLog.create({
      data: {
        tenantId: item.tenantId,
        actorId: "SYSTEM",
        actorName: "Retention Cron",
        action: "compliance.unapproved_portfolio_purged",
        entityType: "PortfolioItem",
        entityId: item.id,
        metadata: JSON.stringify({ reason: "Unapproved for > 1 year" })
      }
    });

    oldPortfoliosPurged++;
  }

  return {
    expiredPassportsPurged,
    oldPortfoliosPurged
  };
}
