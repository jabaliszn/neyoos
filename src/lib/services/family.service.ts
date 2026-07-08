import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";
import { scopeWhere } from "@/lib/services/student.service";
import { applyDiscount } from "@/lib/services/finance.service";

/**
 * R.8 (2026-07-04, founder request) — phone-number sibling-detection
 * fallback. Two Guardian rows created separately (e.g. two different
 * admissions, or two CSV imports done years apart) can genuinely belong to
 * the SAME real parent even though nothing ever formally linked them as one
 * Guardian record. When that parent's phone number shows up on a second
 * Guardian row AND the name on that row is recognisably the same person
 * (order-independent, case/whitespace-insensitive — "Otieno Brian" and
 * "Brian Otieno" are the same person), NEYO now automatically treats both
 * families as one for sibling counting / sibling discount purposes — no
 * manual "link these" step required (the founder's explicit answer: "auto
 * detect and apply"). A phone shared by two UNRELATED parents (a re-issued
 * SIM, a shared family line used by an uncle/grandparent) is guarded against
 * by ALSO requiring the name match — phone alone is never enough.
 */
function normalizeNameForMatch(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/** True if two guardian full names are plausibly the SAME real person. */
export function namesLikelySamePerson(a: string, b: string): boolean {
  const na = normalizeNameForMatch(a);
  const nb = normalizeNameForMatch(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ta = new Set(na.split(" ").filter(Boolean));
  const tb = new Set(nb.split(" ").filter(Boolean));
  // Require at least 2 whole-word tokens in common (covers "Otieno Brian"
  // vs "Brian Otieno Mwangi") — a single shared token (e.g. a common
  // surname) is not enough evidence on its own.
  if (ta.size < 2 || tb.size < 2) return false;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared >= 2;
}

/**
 * Expand a set of Guardian ids into the FULL real family — every guardian
 * id reachable by a chain of (same phone number + same real person's name)
 * matches, tenant-wide. Converges in practice after 1–2 passes (families are
 * small); a hard pass cap and result-size cap keep this safe even against a
 * pathological shared-office-line phone number used on many unrelated
 * admissions.
 */
export async function expandGuardianFamilyIds(baseGuardianIds: string[]): Promise<string[]> {
  if (baseGuardianIds.length === 0) return [];
  const ids = new Set(baseGuardianIds);
  for (let pass = 0; pass < 4 && ids.size < 200; pass++) {
    const known = await tenantDb().guardian.findMany({
      where: { id: { in: Array.from(ids) } },
      select: { id: true, phone: true, fullName: true },
    });
    const phones = Array.from(new Set(known.map((g) => g.phone)));
    if (phones.length === 0) break;
    const candidates = await tenantDb().guardian.findMany({
      where: { phone: { in: phones } },
      select: { id: true, phone: true, fullName: true },
    });
    let grew = false;
    for (const cand of candidates) {
      if (ids.has(cand.id)) continue;
      const matchesSomeone = known.some(
        (k) => k.phone === cand.phone && namesLikelySamePerson(k.fullName, cand.fullName)
      );
      if (matchesSomeone) {
        ids.add(cand.id);
        grew = true;
      }
    }
    if (!grew) break;
  }
  return Array.from(ids);
}

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

    const directGuardianIds = student.guardians.map((g) => g.guardianId);
    const guardians = student.guardians.map((g) => ({
      id: g.guardian.id,
      fullName: g.guardian.fullName,
      phone: g.guardian.phone,
      relationship: g.relationship,
      isPrimary: g.isPrimary,
      hasPortal: !!g.guardian.userId,
    }));

    // R.8 — expand to the real family via the phone+name fallback, so two
    // guardian records for the SAME real parent (created separately, never
    // formally linked) are still recognised as one family.
    const guardianIds = await expandGuardianFamilyIds(directGuardianIds);

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
        const invoices = await tenantDb().invoice.findMany({ where: { studentId: c.id }, orderBy: { dueDate: "asc" } });
        const balance = invoices.reduce((s, i) => s + balanceOf(i), 0);
        const billed = invoices.reduce((s, i) => s + (i.totalKes - i.discountKes), 0);
        const paid = invoices.reduce((s, i) => s + Math.min(i.paidKes, i.totalKes - i.discountKes), 0);
        // The oldest still-open invoice — what a one-tap sibling discount
        // would actually be applied to for this child.
        const openInvoice = invoices.find((i) => balanceOf(i) > 0) ?? null;
        return {
          id: c.id,
          name: fullName(c),
          admissionNo: c.admissionNo,
          className: c.schoolClass ? [c.schoolClass.level, c.schoolClass.stream].filter(Boolean).join(" ") : "Unassigned",
          photoUrl: c.photoUrl,
          balanceKes: balance,
          billedKes: billed,
          paidKes: paid,
          // R.2 — a student with zero invoices ever raised must be shown as
          // "no fees billed yet", never as "cleared" (which implies real
          // money was owed and genuinely paid off).
          hasFeeInvoices: invoices.length > 0,
          isCurrent: c.id === studentId,
          openInvoiceId: openInvoice?.id ?? null,
          // R.3 — the invoice's real totalKes, needed client-side so the UI
          // can compute the EXACT same discount amount the server will
          // (Math.round(total * pct / 100)) and request a biometric ticket
          // bound to that precise amount via the same discountActionKey().
          openInvoiceTotalKes: openInvoice?.totalKes ?? null,
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
    const directGuardianIds = links.map((l) => l.guardianId);
    if (directGuardianIds.length === 0) return 0;
    // R.8 — same phone+name fallback used everywhere else in this file.
    const guardianIds = await expandGuardianFamilyIds(directGuardianIds);
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
export async function applySiblingDiscount(user: SessionUser, invoiceId: string, pctOverride?: number, biometricTicket?: string) {
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

    // R.3 — the real biometric ticket, if this school requires one, flows
    // straight through to applyDiscount()'s own real server-side check.
    return applyDiscount(user, invoiceId, amountKes, `Sibling discount (${pct}%)`, biometricTicket);
  });
}

/**
 * R.8 (founder request 2026-07-04) — a school's own sibling-discount %,
 * editable in Finance settings (0 = off, default). Only leadership
 * (tenant.manage_settings, enforced at the route) may change it. Replaces
 * the old platform-wide flat-10% `enable_sibling_discount` master switch,
 * which is retired — every school now controls its own number directly.
 */
export async function getSiblingDiscountSetting(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const tenant = await db.tenant.findUniqueOrThrow({
      where: { id: user.tenantId },
      select: { siblingDiscountPct: true },
    });
    return { siblingDiscountPct: tenant.siblingDiscountPct };
  });
}

export async function setSiblingDiscountSetting(user: SessionUser, pct: number) {
  return withTenant(user.tenantId, async () => {
    if (!Number.isInteger(pct) || pct < 0 || pct > 100) {
      throw new FamilyError("INVALID", "Sibling discount must be a whole number between 0 and 100.");
    }
    await db.tenant.update({ where: { id: user.tenantId }, data: { siblingDiscountPct: pct } });
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "finance.sibling_discount_pct_updated",
        entityType: "Tenant",
        entityId: user.tenantId,
        metadata: JSON.stringify({ siblingDiscountPct: pct }),
      },
    });
    return { siblingDiscountPct: pct };
  });
}
