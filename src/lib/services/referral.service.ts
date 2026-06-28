import { db } from "@/lib/db";
import crypto from "crypto";

// Generate a random 6-character referral code (e.g. NEYO-AB39F)
export async function ensureReferralCode(tenantId: string) {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error("Tenant not found");
  
  if (tenant.referralCode) return tenant.referralCode;

  const raw = crypto.randomBytes(3).toString("hex").toUpperCase();
  const code = "NEYO-" + raw;

  await db.tenant.update({
    where: { id: tenantId },
    data: { referralCode: code }
  });

  return code;
}

/**
 * Validates and links a new school to the referring school.
 * To be called during Onboarding or initial subscription payment.
 */
export async function applyReferralCode(newTenantId: string, code: string) {
  const codeClean = code.trim().toUpperCase();
  const referrer = await db.tenant.findUnique({ where: { referralCode: codeClean } });
  
  if (!referrer) throw new Error("Invalid referral code.");
  if (referrer.id === newTenantId) throw new Error("Cannot refer yourself.");

  const newTenant = await db.tenant.findUnique({ where: { id: newTenantId } });
  if (newTenant?.referredByTenantId) throw new Error("Already applied a referral code.");

  await db.tenant.update({
    where: { id: newTenantId },
    data: { referredByTenantId: referrer.id }
  });

  return true;
}

/**
 * Fires when a school PAYS an invoice.
 * Grants a 5% discount to both the new school and the referring school if they haven't claimed it yet.
 */
export async function processReferralRewards(payingTenantId: string) {
  const tenant = await db.tenant.findUnique({ where: { id: payingTenantId } });
  if (!tenant || !tenant.referredByTenantId || tenant.hasClaimedReferral) return false;

  const referrer = await db.tenant.findUnique({ where: { id: tenant.referredByTenantId } });
  if (!referrer) return false;

  // Mark the referral as claimed so it only fires on the FIRST invoice payment.
  await db.tenant.update({
    where: { id: payingTenantId },
    data: { hasClaimedReferral: true }
  });

  // Credit 5% to the new school
  await applyDiscountToNextInvoice(payingTenantId, 0.05, "Referral Bonus (Referred by " + referrer.name + ")");
  
  // Credit 5% to the referring school
  await applyDiscountToNextInvoice(referrer.id, 0.05, "Referral Bonus (You referred " + tenant.name + ")");

  return true;
}

async function applyDiscountToNextInvoice(tenantId: string, discountPct: number, reason: string) {
  // In a real system, we'd add this to a 'CreditsLedger' or immediately apply it to a pending invoice.
  // For now, we simulate inserting an audit log / credit note.
  await db.auditLog.create({
    data: {
      tenantId,
      actorId: "SYSTEM",
      actorName: "NEYO Billing",
      action: "billing.referral_credit_applied",
      entityType: "Tenant",
      entityId: tenantId,
      metadata: JSON.stringify({ discountPct, reason })
    }
  });
}
