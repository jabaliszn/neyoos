/**
 * B.25 Expenses API.
 * GET  /api/expenses              — board (inventory.view)
 * GET  /api/expenses?reports=1&month=YYYY-MM — month report (inventory.view)
 * POST /api/expenses {action: expense|category|cost_center|seed_presets|archive_category|archive_cost_center|approve|reject}
 *   - approve / reject = LEADERSHIP ONLY (tenant.manage_settings) — the threshold gate.
 *   - everything else = inventory.manage (bursar territory).
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import {
  expensesBoard, expenseReports, createExpense, addCategory, addCostCenter,
  seedPresets, archiveCategory, archiveCostCenter, approveExpense, rejectExpense,
} from "@/lib/services/expense.service";
import {
  expenseSchema, categorySchema, costCenterSchema, rejectSchema, reportQuerySchema,
  EXPENSE_CATEGORY_PRESETS, COST_CENTER_PRESETS,
} from "@/lib/validations/expense";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("inventory.view");
    const sp = req.nextUrl.searchParams;
    if (sp.get("reports")) {
      const { month } = reportQuerySchema.parse({ month: sp.get("month") || undefined });
      return ok(await expenseReports(user, month));
    }
    return ok(await expensesBoard(user));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = z.object({
      action: z.enum([
        "expense", "category", "cost_center", "seed_presets",
        "archive_category", "archive_cost_center", "approve", "reject",
      ]),
    }).parse(body).action;

    // Approval / rejection is the leadership gate.
    if (action === "approve") {
      const user = await requirePermission("tenant.manage_settings");
      const { expenseId } = z.object({ expenseId: z.string().min(1) }).parse(body);
      return ok(await approveExpense(user, expenseId));
    }
    if (action === "reject") {
      const user = await requirePermission("tenant.manage_settings");
      const input = rejectSchema.parse(body);
      return ok(await rejectExpense(user, input.expenseId, input.reason));
    }

    const user = await requirePermission("inventory.manage");
    if (action === "expense") {
      return ok(await createExpense(user, expenseSchema.parse(body)), 201);
    }
    if (action === "category") {
      const { name } = categorySchema.parse(body);
      return ok(await addCategory(user, name), 201);
    }
    if (action === "cost_center") {
      const { name } = costCenterSchema.parse(body);
      return ok(await addCostCenter(user, name), 201);
    }
    if (action === "seed_presets") {
      return ok(await seedPresets(user, [...EXPENSE_CATEGORY_PRESETS], [...COST_CENTER_PRESETS]));
    }
    if (action === "archive_category") {
      const { id } = z.object({ id: z.string().min(1) }).parse(body);
      return ok(await archiveCategory(user, id));
    }
    const { id } = z.object({ id: z.string().min(1) }).parse(body);
    return ok(await archiveCostCenter(user, id));
  } catch (e) {
    return handleError(e);
  }
}
