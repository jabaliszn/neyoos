import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { transferPassportRequestSchema } from "@/lib/validations/digital-identity";
import { initiateTransferPassport, getOutgoingTransfers } from "@/lib/services/digital-identity.service";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("students.view");
    const studentId = req.nextUrl.searchParams.get("studentId");
    if (!studentId) return fail("INVALID", "studentId required", 400);

    const transfers = await getOutgoingTransfers(user, studentId);
    return ok({ data: transfers });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("students.manage"); // Need high permission to export data
    const body = await req.json();
    const data = transferPassportRequestSchema.parse(body);
    const request = await initiateTransferPassport(user, data);
    return ok({ data: request }, 201);
  } catch (error) {
    if ((error as any).name === "ZodError") {
      return fail("INVALID", (error as any).errors[0].message, 400);
    }
    return handleError(error);
  }
}
