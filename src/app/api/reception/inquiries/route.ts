import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { withTenant } from "@/lib/core/tenant-context";
import { admissionInquirySchema } from "@/lib/validations/reception";
import { captureInquiry, todayInquiries } from "@/lib/services/reception.service";
import { db } from "@/lib/db";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/reception/inquiries — today's admission inquiries (A.18.6). */
export async function GET() {
  try {
    const user = await requirePermission("reception.operate");
    const inquiries = await withTenant(user.tenantId, todayInquiries);
    return ok({ inquiries });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/reception/inquiries — capture a walk-in admission inquiry (A.18.6). */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("reception.operate");
    const input = admissionInquirySchema.parse(await req.json().catch(() => ({})));
    const inquiry = await withTenant(user.tenantId, () =>
      captureInquiry(user.tenantId, input, user.id)
    );
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "admission.inquiry.create",
        entityType: "AdmissionInquiry",
        entityId: inquiry.id,
        metadata: JSON.stringify({ parentName: input.parentName, gradeWanted: input.gradeWanted }),
      },
    });
    return ok({ id: inquiry.id }, 201);
  } catch (err) {
    return handleError(err);
  }
}
