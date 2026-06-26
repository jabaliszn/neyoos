/**
 * H.2 Customized Printing Limits (founder 2026-06-14).
 *
 * RULE: Privileged roles (Principal, Deputy, Academics HOD, School Owner,
 * Super Admin) can print without limit AND set the per-day limit for everyone
 * else. Non-privileged roles are capped at Tenant.printLimitPerDay documents
 * per day; once over, they must raise a PrintApprovalRequest that a privileged
 * user approves — an approval lets them print exactly one more document.
 *
 * Daily count is stored in the existing UsageCounter table (no new counter
 * table) with metric "print:<userId>" and a per-day periodKey, so it resets
 * naturally every Nairobi day.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";

export class PrintLimitError extends Error {
  constructor(
    public code: "LIMIT_REACHED" | "FORBIDDEN" | "NOT_FOUND" | "INVALID",
    message: string
  ) {
    super(message);
    this.name = "PrintLimitError";
  }
}

/** Roles that bypass the limit and may set it / approve requests. */
const PRIVILEGED_PRINT_ROLES = [
  "PRINCIPAL",
  "DEPUTY_PRINCIPAL",
  "HOD",
  "SCHOOL_OWNER",
  "SUPER_ADMIN",
] as const;

export function isPrivilegedPrinter(user: SessionUser): boolean {
  const set = PRIVILEGED_PRINT_ROLES as readonly string[];
  return set.includes(user.role) || (!!user.secondaryRole && set.includes(user.secondaryRole));
}

/**
 * Families (PARENT/STUDENT) are NEVER limited — they only ever print their own
 * child's documents. The limit targets staff churning out school documents.
 */
function isExemptFromLimit(user: SessionUser): boolean {
  return user.role === "PARENT" || user.role === "STUDENT" || isPrivilegedPrinter(user);
}

/** Nairobi-day key, e.g. "print:cuid:2026-06-17". */
function dayKey(userId: string, now = new Date()): string {
  const nairobi = new Date(now.getTime() + 3 * 3600_000);
  return `print:${userId}:${nairobi.toISOString().slice(0, 10)}`;
}

/** How many documents this user has printed today. */
export async function printsToday(tenantId: string, userId: string): Promise<number> {
  const row = await db.usageCounter.findUnique({
    where: { tenantId_metric_periodKey: { tenantId, metric: `print:${userId}`, periodKey: dayKey(userId).split(":").pop()! } },
  });
  return row?.used ?? 0;
}

/**
 * Gate a print. Privileged roles pass freely. Others are checked against the
 * daily limit; if at/over the limit, an APPROVED PrintApprovalRequest for this
 * docKind is consumed instead (and marked USED). Otherwise LIMIT_REACHED.
 * Call recordPrint() AFTER the document is actually built.
 */
export async function assertCanPrint(
  user: SessionUser,
  docKind: string,
  docRef?: string
): Promise<{ usedApproval: boolean }> {
  return withTenant(user.tenantId, async () => {
    if (isExemptFromLimit(user)) return { usedApproval: false };

    const tenant = await tenantDb().tenant.findUnique({ where: { id: user.tenantId } });
    const limit = tenant?.printLimitPerDay ?? 0;
    // 0 / null = unlimited (limits are opt-in per school).
    if (!limit || limit <= 0) return { usedApproval: false };

    const day = dayKey(user.id).split(":").pop()!;
    const counter = await db.usageCounter.findUnique({
      where: { tenantId_metric_periodKey: { tenantId: user.tenantId, metric: `print:${user.id}`, periodKey: day } },
    });
    const used = counter?.used ?? 0;

    if (used < limit) return { usedApproval: false };

    // At/over the limit — look for an APPROVED, unused approval for this kind.
    const approval = await tenantDb().printApprovalRequest.findFirst({
      where: {
        requestedById: user.id,
        docKind,
        status: "APPROVED",
        ...(docRef ? { docRef } : {}),
      },
      orderBy: { decidedAt: "desc" },
    });
    if (approval) {
      await db.printApprovalRequest.update({ where: { id: approval.id }, data: { status: "USED" } });
      return { usedApproval: true };
    }

    throw new PrintLimitError(
      "LIMIT_REACHED",
      `You've reached today's print limit of ${limit}. Ask the Principal, Deputy or Academics HOD to approve another print.`
    );
  });
}

/** Increment the daily print count. Call after a successful build/print. */
export async function recordPrint(user: SessionUser): Promise<void> {
  if (isExemptFromLimit(user)) return; // not counted for exempt users (families + privileged)
  const day = dayKey(user.id).split(":").pop()!;
  await db.usageCounter.upsert({
    where: { tenantId_metric_periodKey: { tenantId: user.tenantId, metric: `print:${user.id}`, periodKey: day } },
    update: { used: { increment: 1 } },
    create: { tenantId: user.tenantId, metric: `print:${user.id}`, periodKey: day, used: 1 },
  });
}

/** Privileged: set the school's per-day print limit (0 = unlimited). */
export async function setPrintLimit(user: SessionUser, perDay: number): Promise<{ printLimitPerDay: number }> {
  return withTenant(user.tenantId, async () => {
    if (!isPrivilegedPrinter(user)) {
      throw new PrintLimitError("FORBIDDEN", "Only the Principal, Deputy or Academics HOD can change print limits.");
    }
    if (!Number.isInteger(perDay) || perDay < 0 || perDay > 1000) {
      throw new PrintLimitError("INVALID", "Print limit must be a whole number between 0 and 1000 (0 = unlimited).");
    }
    await db.tenant.update({ where: { id: user.tenantId }, data: { printLimitPerDay: perDay } });
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "print.limit_updated",
        entityType: "tenant",
        entityId: user.tenantId,
        metadata: JSON.stringify({ printLimitPerDay: perDay }),
      },
    });
    return { printLimitPerDay: perDay };
  });
}

/** Non-privileged user raises a request to print one more document. */
export async function requestPrintApproval(
  user: SessionUser,
  input: { docKind: string; docRef?: string; reason?: string }
) {
  return withTenant(user.tenantId, async () => {
    // Avoid stacking duplicate pending requests for the same doc.
    const existing = await tenantDb().printApprovalRequest.findFirst({
      where: { requestedById: user.id, docKind: input.docKind, docRef: input.docRef ?? null, status: "PENDING" },
    });
    if (existing) return existing;
    const row = await db.printApprovalRequest.create({
      data: {
        tenantId: user.tenantId,
        requestedById: user.id,
        requestedByName: user.fullName,
        docKind: input.docKind,
        docRef: input.docRef ?? null,
        reason: input.reason ?? null,
        status: "PENDING",
      },
    });
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "print.approval_requested",
        entityType: "printApprovalRequest",
        entityId: row.id,
        metadata: JSON.stringify({ docKind: input.docKind, docRef: input.docRef }),
      },
    });
    return row;
  });
}

/** Privileged: list pending requests + this school's current limit. */
export async function printApprovalBoard(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const tenant = await tenantDb().tenant.findUnique({ where: { id: user.tenantId } });
    const pending = await tenantDb().printApprovalRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return {
      printLimitPerDay: tenant?.printLimitPerDay ?? 0,
      canManage: isPrivilegedPrinter(user),
      pending,
    };
  });
}

/** Privileged: approve or reject a print request. */
export async function decidePrintApproval(
  user: SessionUser,
  requestId: string,
  approve: boolean
) {
  return withTenant(user.tenantId, async () => {
    if (!isPrivilegedPrinter(user)) {
      throw new PrintLimitError("FORBIDDEN", "Only the Principal, Deputy or Academics HOD can decide print requests.");
    }
    const req = await tenantDb().printApprovalRequest.findUnique({ where: { id: requestId } });
    if (!req) throw new PrintLimitError("NOT_FOUND", "Print request not found.");
    if (req.status !== "PENDING") throw new PrintLimitError("INVALID", "This request has already been decided.");
    const row = await db.printApprovalRequest.update({
      where: { id: requestId },
      data: {
        status: approve ? "APPROVED" : "REJECTED",
        decidedById: user.id,
        decidedByName: user.fullName,
        decidedAt: new Date(),
      },
    });
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: approve ? "print.approval_granted" : "print.approval_rejected",
        entityType: "printApprovalRequest",
        entityId: requestId,
        metadata: JSON.stringify({ requestedBy: req.requestedByName, docKind: req.docKind }),
      },
    });
    return row;
  });
}
