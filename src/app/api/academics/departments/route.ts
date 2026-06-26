/** B.4 departments. GET (academics.view) · POST create · PATCH via ?id=. */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError, fail } from "@/lib/api/respond";
import { departmentSchema } from "@/lib/validations/academics";
import { listDepartments, createDepartment, updateDepartment } from "@/lib/services/academics.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requirePermission("academics.view");
    return ok({ departments: await listDepartments(user) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("academics.manage");
    const input = departmentSchema.parse(await req.json());
    return ok(await createDepartment(user, input));
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requirePermission("academics.manage");
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return fail("MISSING_ID", "Department id required.", 400);
    const input = departmentSchema.partial().parse(await req.json());
    return ok(await updateDepartment(user, id, input));
  } catch (e) {
    return handleError(e);
  }
}
