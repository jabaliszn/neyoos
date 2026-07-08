import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { requireRevenueFeature } from "@/lib/services/tier-gating.service";
import { ok, fail, handleError } from "@/lib/api/respond";
import { transferPassportRequestSchema, transferPassportRedeemSchema } from "@/lib/validations/digital-identity";
import { initiateTransferPassport, getOutgoingTransfers, redeemTransferPassport } from "@/lib/services/digital-identity.service";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("student.view");
    await requireRevenueFeature(user, "transfer_passport");
    const redeemCode = req.nextUrl.searchParams.get("accessCode");
    if (redeemCode) {
      const result = await redeemTransferPassport(user, transferPassportRedeemSchema.parse({ accessCode: redeemCode }));
      return ok(result);
    }

    const studentId = req.nextUrl.searchParams.get("studentId");
    if (!studentId) return fail("INVALID", "studentId required", 400);

    const transfers = await getOutgoingTransfers(user, studentId);
    return ok(transfers);
  } catch (error) {
    if ((error as any).name === "ZodError") {
      return fail("INVALID", (error as any).errors?.[0]?.message || "Invalid request", 400);
    }
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("student.edit");
    await requireRevenueFeature(user, "transfer_passport");
    const body = await req.json();
    if (body?.action === "redeem") {
      const result = await redeemTransferPassport(user, transferPassportRedeemSchema.parse(body));
      return ok(result);
    }
    const data = transferPassportRequestSchema.parse(body);
    const request = await initiateTransferPassport(user, data);
    return ok(request, 201);
  } catch (error) {
    if ((error as any).name === "ZodError") {
      return fail("INVALID", (error as any).errors?.[0]?.message || "Invalid request", 400);
    }
    return handleError(error);
  }
}
