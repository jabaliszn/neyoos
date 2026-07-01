import { db } from "@/lib/db";
import { DIGITAL_IDENTITY_MODULES } from "@/lib/validations/digital-identity";

/**
 * J.22 Compliance & Data Retention Engine.
 *
 * Two responsibilities:
 *  1. `enforceDataRetentionPolicies()` — a platform cron that automatically
 *     purges expired PII and transfer-passport payloads (data minimization),
 *     minimizing NEYO's liability under Kenya's Data Protection Act (ODPC).
 *  2. `assertLawfulTransferBasis()` — an ENFORCED lawful-basis / purpose-
 *     limitation guard (ODPC s.30 "lawful basis", s.25 "data minimisation").
 *     It is called on the live transfer path so a transfer cannot proceed
 *     without recorded consent and a minimised, valid module set.
 */

/** Compliance error raised when an ODPC lawful-basis check fails. */
export class ComplianceError extends Error {
  code: "FORBIDDEN" | "INVALID";
  fields?: Record<string, string>;
  constructor(code: "FORBIDDEN" | "INVALID", message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "ComplianceError";
    this.code = code;
    this.fields = fields;
  }
}

/** Sensitive modules that carry the highest ODPC duty of care. */
export const SENSITIVE_MODULES = ["MEDICAL", "DISCIPLINE"] as const;

/**
 * Enforced ODPC lawful-basis + data-minimisation guard for a transfer passport.
 * Throws `ComplianceError` if the basis is not lawful. Returns the (validated,
 * de-duplicated) module set the transfer is permitted to carry.
 *
 * ODPC mapping:
 *  - Lawful basis (consent): a named consenting guardian MUST be recorded.
 *  - Data minimisation: at least one — and only valid — modules may be carried;
 *    unknown/duplicate modules are rejected.
 *  - Explicit approval for special-category data: MEDICAL/DISCIPLINE are only
 *    permitted when explicitly listed (they are never bundled implicitly).
 */
export function assertLawfulTransferBasis(input: {
  consentBy?: string | null;
  includedModules: string[];
}): { lawfulModules: string[]; sensitiveIncluded: string[] } {
  const consent = (input.consentBy ?? "").trim();
  if (consent.length < 2) {
    throw new ComplianceError(
      "FORBIDDEN",
      "ODPC lawful basis missing: a named consenting parent/guardian is required before any learner data may be transferred.",
      { consentBy: "Consenting guardian name is required." },
    );
  }

  const valid = new Set<string>(DIGITAL_IDENTITY_MODULES);
  const unknown = input.includedModules.filter((m) => !valid.has(m));
  if (unknown.length > 0) {
    throw new ComplianceError(
      "INVALID",
      `ODPC data-minimisation violation: unknown data module(s) requested: ${unknown.join(", ")}.`,
      { includedModules: "Contains modules that are not recognised." },
    );
  }

  const lawfulModules = Array.from(new Set(input.includedModules));
  if (lawfulModules.length === 0) {
    throw new ComplianceError(
      "INVALID",
      "ODPC data-minimisation: a transfer must carry at least one explicitly selected data module.",
      { includedModules: "Select at least one module." },
    );
  }

  const sensitiveIncluded = lawfulModules.filter((m) =>
    (SENSITIVE_MODULES as readonly string[]).includes(m),
  );

  return { lawfulModules, sensitiveIncluded };
}

/**
 * Platform retention cron. Wipes expired transfer-passport payloads and purges
 * stale unapproved portfolio evidence. Runs cross-tenant as a system job.
 */
export async function enforceDataRetentionPolicies() {
  const now = new Date();

  let expiredPassportsPurged = 0;
  let oldPortfoliosPurged = 0;

  // 1. Purge expired Transfer Passport payloads (minimization).
  // We keep the log record, but wipe the highly sensitive payloadJson.
  const expiredRequests = await db.transferPassportRequest.findMany({
    where: {
      expiresAt: { lt: now },
      payloadJson: { not: null },
    },
    select: { id: true, sourceTenantId: true },
  });

  for (const req of expiredRequests) {
    await db.transferPassportRequest.update({
      where: { id: req.id },
      data: {
        payloadJson: null,
        status: "EXPIRED",
      },
    });

    await db.auditLog.create({
      data: {
        tenantId: req.sourceTenantId,
        actorId: "SYSTEM",
        actorName: "Retention Cron",
        action: "compliance.transfer_passport_payload_purged",
        entityType: "TransferPassportRequest",
        entityId: req.id,
        metadata: JSON.stringify({ reason: "Access period expired" }),
      },
    });

    expiredPassportsPurged++;
  }

  // 2. Purge old unapproved (DRAFT) portfolio items (> 1 year old) to save storage.
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const oldPortfolios = await db.portfolioItem.findMany({
    where: {
      status: "DRAFT",
      createdAt: { lt: oneYearAgo },
    },
    select: { id: true, tenantId: true },
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
        metadata: JSON.stringify({ reason: "Unapproved for > 1 year" }),
      },
    });

    oldPortfoliosPurged++;
  }

  return {
    expiredPassportsPurged,
    oldPortfoliosPurged,
  };
}
