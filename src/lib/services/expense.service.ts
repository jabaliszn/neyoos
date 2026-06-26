import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";
import type { ExpenseInput } from "@/lib/validations/expense";

/**
 * B.25 — Expenses Tracking: categories + cost centers (reporting dimensions) →
 * Expense (spend with a threshold approval state-machine + optional receipt
 * photo) → reports by category / cost-center / month that feed the honest
 * B.24 profitability line.
 *
 * Permission model: inventory.manage records/approves-low expenses (bursar
 * territory). APPROVAL above the tenant threshold = LEADERSHIP
 * (tenant.manage_settings) — enforced in the API. Creator can never approve
 * their own spend.
 *
 * OCR auto-extract from the receipt is Bundi-gated (deferred): the receipt is
 * stored via A.9 and manual entry works fully without it.
 */

export class ExpenseError extends Error {
  constructor(public code: "NOT_FOUND" | "INVALID" | "FORBIDDEN" | "STATE" | "DUPLICATE", message: string) {
    super(message);
  }
}

async function audit(user: SessionUser, action: string, entityType: string, entityId: string, metadata: Record<string, unknown>) {
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
      action, entityType, entityId, metadata: JSON.stringify(metadata),
    },
  });
}

// ---- Dimensions: categories + cost centers --------------------------------

export async function addCategory(user: SessionUser, name: string) {
  return withTenant(user.tenantId, async () => {
    const exists = await tenantDb().expenseCategory.findFirst({ where: { name: { equals: name.trim() } } });
    if (exists) throw new ExpenseError("DUPLICATE", "That category already exists.");
    const row = await db.expenseCategory.create({ data: { tenantId: user.tenantId, name: name.trim() } });
    await audit(user, "expense.category_created", "expenseCategory", row.id, { name: row.name });
    return row;
  });
}

export async function addCostCenter(user: SessionUser, name: string) {
  return withTenant(user.tenantId, async () => {
    const exists = await tenantDb().costCenter.findFirst({ where: { name: { equals: name.trim() } } });
    if (exists) throw new ExpenseError("DUPLICATE", "That cost center already exists.");
    const row = await db.costCenter.create({ data: { tenantId: user.tenantId, name: name.trim() } });
    await audit(user, "expense.cost_center_created", "costCenter", row.id, { name: row.name });
    return row;
  });
}

/** Idempotent: seed the KE starter dimensions, skipping any that already exist. */
export async function seedPresets(user: SessionUser, categories: string[], costCenters: string[]) {
  return withTenant(user.tenantId, async () => {
    const haveCats = new Set((await tenantDb().expenseCategory.findMany({ select: { name: true } })).map((c) => c.name));
    const haveCcs = new Set((await tenantDb().costCenter.findMany({ select: { name: true } })).map((c) => c.name));
    let added = 0;
    for (const name of categories) {
      if (!haveCats.has(name.trim())) { await db.expenseCategory.create({ data: { tenantId: user.tenantId, name: name.trim() } }); added++; }
    }
    for (const name of costCenters) {
      if (!haveCcs.has(name.trim())) { await db.costCenter.create({ data: { tenantId: user.tenantId, name: name.trim() } }); added++; }
    }
    if (added) await audit(user, "expense.presets_seeded", "tenant", user.tenantId, { added });
    return { added };
  });
}

export async function archiveCategory(user: SessionUser, id: string) {
  return withTenant(user.tenantId, async () => {
    const row = await tenantDb().expenseCategory.findUnique({ where: { id } });
    if (!row) throw new ExpenseError("NOT_FOUND", "Category not found.");
    await tenantDb().expenseCategory.update({ where: { id }, data: { archived: !row.archived } });
    await audit(user, "expense.category_archived", "expenseCategory", id, { archived: !row.archived });
    return { archived: !row.archived };
  });
}

export async function archiveCostCenter(user: SessionUser, id: string) {
  return withTenant(user.tenantId, async () => {
    const row = await tenantDb().costCenter.findUnique({ where: { id } });
    if (!row) throw new ExpenseError("NOT_FOUND", "Cost center not found.");
    await tenantDb().costCenter.update({ where: { id }, data: { archived: !row.archived } });
    await audit(user, "expense.cost_center_archived", "costCenter", id, { archived: !row.archived });
    return { archived: !row.archived };
  });
}

// ---- The spend record ------------------------------------------------------

/**
 * Record a spend. Threshold rule:
 * amount > Tenant.expenseApprovalThresholdKes => PENDING_APPROVAL (leadership),
 * otherwise auto-APPROVED so small spends never block on the principal.
 * Category/cost-center names are FROZEN onto the row for the reports.
 */
export async function createExpense(user: SessionUser, input: ExpenseInput) {
  return withTenant(user.tenantId, async () => {
    const category = await tenantDb().expenseCategory.findUnique({ where: { id: input.categoryId } });
    if (!category) throw new ExpenseError("NOT_FOUND", "Category not found — add it first.");
    if (category.archived) throw new ExpenseError("STATE", "That category is archived.");

    let costCenter: { id: string; name: string } | null = null;
    if (input.costCenterId) {
      const cc = await tenantDb().costCenter.findUnique({ where: { id: input.costCenterId } });
      if (!cc) throw new ExpenseError("NOT_FOUND", "Cost center not found.");
      costCenter = { id: cc.id, name: cc.name };
    }
    if (input.amountKes <= 0) throw new ExpenseError("INVALID", "Amount must be above zero.");

    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: user.tenantId } });
    const needsApproval = input.amountKes > tenant.expenseApprovalThresholdKes;

    const row = await db.expense.create({
      data: {
        tenantId: user.tenantId,
        categoryId: category.id, categoryName: category.name,
        costCenterId: costCenter?.id ?? null, costCenterName: costCenter?.name ?? null,
        payee: input.payee.trim(),
        amountKes: input.amountKes,
        spentOn: input.spentOn,
        note: input.note?.trim() || null,
        receiptFileUrl: input.receiptFileUrl?.trim() || null,
        receiptFileName: input.receiptFileName?.trim() || null,
        status: needsApproval ? "PENDING_APPROVAL" : "APPROVED",
        ...(needsApproval ? {} : { approvedById: user.id, approvedByName: `${user.fullName} (under threshold)`, approvedAt: new Date() }),
        createdById: user.id, createdByName: user.fullName,
      },
    });
    await audit(user, "expense.created", "expense", row.id, {
      payee: row.payee, amountKes: row.amountKes, category: category.name,
      needsApproval, thresholdKes: tenant.expenseApprovalThresholdKes,
    });
    return { ...row, needsApproval };
  });
}

/** Leadership approves a pending expense. Creator cannot approve their own. */
export async function approveExpense(user: SessionUser, expenseId: string) {
  return withTenant(user.tenantId, async () => {
    const e = await tenantDb().expense.findUnique({ where: { id: expenseId } });
    if (!e) throw new ExpenseError("NOT_FOUND", "Expense not found.");
    if (e.status !== "PENDING_APPROVAL") throw new ExpenseError("STATE", "This expense is not waiting for approval.");
    if (e.createdById === user.id)
      throw new ExpenseError("FORBIDDEN", "You recorded this expense — a different leader must approve it.");
    const row = await tenantDb().expense.update({
      where: { id: expenseId },
      data: { status: "APPROVED", approvedById: user.id, approvedByName: user.fullName, approvedAt: new Date(), rejectedReason: null },
    });
    await audit(user, "expense.approved", "expense", expenseId, { payee: e.payee, amountKes: e.amountKes });
    return row;
  });
}

/** Leadership rejects a pending expense with a reason. */
export async function rejectExpense(user: SessionUser, expenseId: string, reason: string) {
  return withTenant(user.tenantId, async () => {
    const e = await tenantDb().expense.findUnique({ where: { id: expenseId } });
    if (!e) throw new ExpenseError("NOT_FOUND", "Expense not found.");
    if (e.status !== "PENDING_APPROVAL") throw new ExpenseError("STATE", "This expense is not waiting for approval.");
    if (e.createdById === user.id)
      throw new ExpenseError("FORBIDDEN", "You recorded this expense — a different leader must decide it.");
    const row = await tenantDb().expense.update({
      where: { id: expenseId },
      data: { status: "REJECTED", rejectedReason: reason.trim(), approvedById: user.id, approvedByName: user.fullName, approvedAt: new Date() },
    });
    await audit(user, "expense.rejected", "expense", expenseId, { payee: e.payee, amountKes: e.amountKes, reason });
    return row;
  });
}

// ---- Board + reports -------------------------------------------------------

/** Board: dimensions + recent expenses + this-month totals (approved vs pending). */
export async function expensesBoard(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: user.tenantId } });
    const [categories, costCenters, expenses] = await Promise.all([
      tenantDb().expenseCategory.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
      tenantDb().costCenter.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
      tenantDb().expense.findMany({ orderBy: { spentOn: "desc" }, take: 50 }),
    ]);

    const monthKey = nairobiMonthKey();
    const thisMonth = await tenantDb().expense.findMany({ where: { spentOn: { startsWith: monthKey } } });
    const approvedThisMonth = thisMonth.filter((e) => e.status === "APPROVED").reduce((s, e) => s + e.amountKes, 0);
    const pendingThisMonth = thisMonth.filter((e) => e.status === "PENDING_APPROVAL").reduce((s, e) => s + e.amountKes, 0);
    const awaiting = expenses.filter((e) => e.status === "PENDING_APPROVAL").length;

    return {
      thresholdKes: tenant.expenseApprovalThresholdKes,
      monthKey,
      approvedThisMonthKes: approvedThisMonth,
      pendingThisMonthKes: pendingThisMonth,
      awaitingApproval: awaiting,
      categories,
      costCenters,
      expenses,
    };
  });
}

/**
 * Reports for a month (YYYY-MM, Nairobi): APPROVED spend grouped by category
 * and by cost center, plus the month total. This is the data the school uses to
 * see where the money went — and what B.24 profitability subtracts.
 */
export async function expenseReports(user: SessionUser, month?: string) {
  return withTenant(user.tenantId, async () => {
    const monthKey = month && /^\d{4}-\d{2}$/.test(month) ? month : nairobiMonthKey();
    const rows = await tenantDb().expense.findMany({ where: { status: "APPROVED", spentOn: { startsWith: monthKey } } });

    const byCategory = groupSum(rows, (e) => e.categoryName);
    const byCostCenter = groupSum(rows, (e) => e.costCenterName ?? "Unassigned");
    const totalKes = rows.reduce((s, e) => s + e.amountKes, 0);

    return { monthKey, totalKes, byCategory, byCostCenter, count: rows.length };
  });
}

/**
 * Total APPROVED expenses since a Date (used by B.24 to make the profitability
 * line honest: collected − payroll − real approved expenses). Tenant-scoped.
 */
export async function approvedExpensesSinceKes(tenantId: string, sinceISODate: string) {
  return withTenant(tenantId, async () => {
    const rows = await tenantDb().expense.findMany({ where: { status: "APPROVED", spentOn: { gte: sinceISODate } } });
    return rows.reduce((s, e) => s + e.amountKes, 0);
  });
}

// ---- helpers ---------------------------------------------------------------

function nairobiMonthKey(): string {
  // Nairobi = UTC+3, no DST.
  const now = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function groupSum<T extends { amountKes: number }>(rows: T[], keyOf: (r: T) => string) {
  const map = new Map<string, number>();
  for (const r of rows) map.set(keyOf(r), (map.get(keyOf(r)) ?? 0) + r.amountKes);
  return Array.from(map.entries())
    .map(([label, totalKes]) => ({ label, totalKes }))
    .sort((a, b) => b.totalKes - a.totalKes);
}
