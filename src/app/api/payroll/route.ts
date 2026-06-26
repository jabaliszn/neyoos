/**
 * B.8 payroll. GET ?view=salaries|runs|run&id= · POST {action:"salary"|"run"|"approve"}.
 * Permission: staff.manage (bursar handles money but staff.manage = leadership;
 * BURSAR gets payroll via finance.manage_structure — both accepted).
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError, fail } from "@/lib/api/respond";
import { listSalaries, setSalary, listRuns, runPayroll, approveRun, runDetail } from "@/lib/services/payroll.service";

export const dynamic = "force-dynamic";

async function payrollUser() {
  // Either staff.manage (leadership) OR finance.manage_structure (bursar).
  try { return await requirePermission("staff.manage"); }
  catch { return await requirePermission("finance.manage_structure"); }
}

export async function GET(req: NextRequest) {
  try {
    const user = await payrollUser();
    const sp = req.nextUrl.searchParams;
    const view = sp.get("view") ?? "runs";
    if (view === "salaries") return ok({ salaries: await listSalaries(user) });
    if (view === "run") {
      const id = sp.get("id");
      if (!id) return fail("MISSING", "id required.", 400);
      return ok({ run: await runDetail(user, id) });
    }
    return ok({ runs: await listRuns(user) });
  } catch (e) {
    return handleError(e);
  }
}

const salarySchema = z.object({
  userId: z.string().min(1),
  basicKes: z.coerce.number().int().min(0).max(10_000_000),
  houseAllowanceKes: z.coerce.number().int().min(0).default(0),
  transportAllowanceKes: z.coerce.number().int().min(0).default(0),
  otherAllowanceKes: z.coerce.number().int().min(0).default(0),
  saccoKes: z.coerce.number().int().min(0).default(0),
  loanKes: z.coerce.number().int().min(0).default(0),
});

export async function POST(req: NextRequest) {
  try {
    const user = await payrollUser();
    const body = await req.json();
    const action = z.enum(["salary", "run", "approve"]).parse(body?.action);
    if (action === "salary") return ok(await setSalary(user, salarySchema.parse(body)));
    if (action === "run") {
      const { period, overtime } = z.object({
        period: z.string().regex(/^\d{4}-\d{2}$/),
        overtime: z.record(z.string(), z.coerce.number().min(0)).default({}),
      }).parse(body);
      return ok(await runPayroll(user, period, overtime));
    }
    const { runId } = z.object({ runId: z.string().min(1) }).parse(body);
    return ok(await approveRun(user, runId));
  } catch (e) {
    return handleError(e);
  }
}
