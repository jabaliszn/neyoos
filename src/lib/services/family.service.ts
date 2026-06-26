import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";
import { scopeWhere } from "@/lib/services/student.service";
import { applyDiscount } from "@/lib/services/finance.service";

/**
 * G.12 — Sibling Intelligence.
 * Siblings = students who share at least one Guardian (no new model — NEYO
 * already reuses one Guardian across a family, B.1 import). This service builds
 * the family view (all the children + one combined fee position) and the
 * sibling-discount seam (applied onto a B.7 invoice).
 *
 * Row-scoping: respects scopeWhere so a PARENT only ever sees their own family;
 * the lookup student must be in the caller's visible set.
 */

export class FamilyError extends Error {
  constructor(public code: "NOT_FOUND" | "INVALID", message: string) {
    super(message);
    this.name = "FamilyError";
  }
}

const fullName = (s: { firstName: string; middleName: string | null; lastName: string }) =>
  [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ");

/** Open balance on an invoice = total − discount − paid, floored at 0. */
function balanceOf(inv: { totalKes: number; discountKes: number; paidKes: number }) {
  return Math.max(0, inv.totalKes - inv.discountKes - inv.paidKes);
}

/**
 * The family for a given student: every sibling who shares a guardian, each
 * child's fee balance, and the combined family balance. The lookup student is
 * always included (as the "current" child).
 */
export async function familyForStudent(user: SessionUser, studentId: string) {
  return withTenant(user.tenantId, async () => {
    const scope = await scopeWhere(user);
    const student = await tenantDb().student.findFirst({
      where: { AND: [{ id: studentId }, scope] },
      include: { guardians: { include: { guardian: true } } },
    });
    if (!student) throw new FamilyError("NOT_FOUND", "Student not found.");

    const guardianIds = student.guardians.map((g) => g.guardianId);
    const guardians = student.guardians.map((g) => ({
      id: g.guardian.id,
      fullName: g.guardian.fullName,
      phone: g.guardian.phone,
      relationship: g.relationship,
      isPrimary: g.isPrimary,
      hasPortal: !!g.guardian.userId,
    }));

    // Sibling student ids = ACTIVE students linked to any of those guardians.
    let siblingIds: string[] = [];
    if (guardianIds.length > 0) {
      const links = await tenantDb().studentGuardian.findMany({
        where: { guardianId: { in: guardianIds } },
        select: { studentId: true },
      });
      siblingIds = Array.from(new Set(links.map((l) => l.studentId)));
    }
    if (!siblingIds.includes(studentId)) siblingIds.push(studentId);

    const children = await tenantDb().student.findMany({
      where: { id: { in: siblingIds }, status: "ACTIVE" },
      include: { schoolClass: true },
      orderBy: [{ admittedOn: "asc" }],
    });

    const kids = await Promise.all(
      children.map(async (c) => {
        const invoices = await tenantDb().invoice.findMany({ where: { studentId: c.id } });
        const balance = invoices.reduce((s, i) => s + balanceOf(i), 0);
        const billed = invoices.reduce((s, i) => s + (i.totalKes - i.discountKes), 0);
        const paid = invoices.reduce((s, i) => s + Math.min(i.paidKes, i.totalKes - i.discountKes), 0);
        return {
          id: c.id,
          name: fullName(c),
          admissionNo: c.admissionNo,
          className: c.schoolClass ? [c.schoolClass.level, c.schoolClass.stream].filter(Boolean).join(" ") : "Unassigned",
          photoUrl: c.photoUrl,
          balanceKes: balance,
          billedKes: billed,
          paidKes: paid,
          isCurrent: c.id === studentId,
        };
      })
    );

    const combinedBalanceKes = kids.reduce((s, k) => s + k.balanceKes, 0);
    const combinedBilledKes = kids.reduce((s, k) => s + k.billedKes, 0);
    const combinedPaidKes = kids.reduce((s, k) => s + k.paidKes, 0);

    const tenant = await db.tenant.findUniqueOrThrow({
      where: { id: user.tenantId },
      select: { siblingDiscountPct: true },
    });

    return {
      siblingCount: Math.max(0, kids.length - 1), // excludes the current child
      guardians,
      children: kids,
      combinedBalanceKes,
      combinedBilledKes,
      combinedPaidKes,
      siblingDiscountPct: tenant.siblingDiscountPct,
    };
  });
}

/** Lightweight sibling count for a profile badge (no fee math). */
export async function siblingCount(user: SessionUser, studentId: string): Promise<number> {
  return withTenant(user.tenantId, async () => {
    const links = await tenantDb().studentGuardian.findMany({
      where: { studentId },
      select: { guardianId: true },
    });
    const guardianIds = links.map((l) => l.guardianId);
    if (guardianIds.length === 0) return 0;
    const sibLinks = await tenantDb().studentGuardian.findMany({
      where: { guardianId: { in: guardianIds } },
      select: { studentId: true },
    });
    const ids = new Set(sibLinks.map((l) => l.studentId));
    ids.delete(studentId);
    if (ids.size === 0) return 0;
    // only count ACTIVE siblings
    return tenantDb().student.count({ where: { id: { in: Array.from(ids) }, status: "ACTIVE" } });
  });
}

/**
 * Sibling discount seam (G.12.4): apply a % discount to a B.7 invoice because
 * the family has 2+ children enrolled. Reuses B.7 applyDiscount (over-discount
 * guard + status transition + audit). pct defaults to Tenant.siblingDiscountPct.
 */
export async function applySiblingDiscount(user: SessionUser, invoiceId: string, pctOverride?: number) {
  return withTenant(user.tenantId, async () => {
    const inv = await tenantDb().invoice.findUnique({ where: { id: invoiceId } });
    if (!inv) throw new FamilyError("NOT_FOUND", "Invoice not found.");

    const tenant = await db.tenant.findUniqueOrThrow({
      where: { id: user.tenantId },
      select: { siblingDiscountPct: true },
    });
    const pct = pctOverride ?? tenant.siblingDiscountPct;
    if (!pct || pct <= 0)
      throw new FamilyError("INVALID", "Set a sibling discount % in Settings, or pass one in.");

    // Confirm the student actually has a sibling (don't discount only-children).
    const sibs = await siblingCount(user, inv.studentId);
    if (sibs < 1)
      throw new FamilyError("INVALID", "This learner has no enrolled sibling — sibling discount does not apply.");

    const amountKes = Math.round((inv.totalKes * pct) / 100);
    if (amountKes <= 0) throw new FamilyError("INVALID", "Computed discount is zero.");

    return applyDiscount(user, invoiceId, amountKes, `Sibling discount (${pct}%)`);
  });
}
