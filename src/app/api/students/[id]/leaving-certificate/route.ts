import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError, fail } from "@/lib/api/respond";
import {
  getLeavingCertificate, recordLeavingCertificate, handOverLeavingCertificate,
} from "@/lib/services/student.service";

export const dynamic = "force-dynamic";

/** GET /api/students/[id]/leaving-certificate — Retrieve a student's leaving certificate record */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("student.view");
    const cert = await getLeavingCertificate(user, params.id);
    return ok({ cert });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/students/[id]/leaving-certificate — Vault or Hand Over a leaving certificate */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("student.edit");
    const body = await req.json().catch(() => ({}));
    const { action } = z.object({ action: z.enum(["vault", "handover"]) }).parse(body);

    if (action === "vault") {
      const input = z.object({
        certificateType: z.enum(["KCPE", "KCSE", "OTHER"]),
        certificateNo: z.string().trim().min(3, "State the certificate number.").max(50),
        hardcopyLocation: z.string().trim().min(3, "Please specify the physical location of the hardcopy certificate (Cabinet, Shelf, etc.)!"),
        fileUrl: z.string().trim().max(500).optional(),
        fileName: z.string().trim().max(200).optional(),
      }).parse(body);
      
      const result = await recordLeavingCertificate(user, {
        studentId: params.id,
        ...input,
      });
      return ok(result);
    }

    if (action === "handover") {
      const { handedOverTo } = z.object({ handedOverTo: z.string().trim().min(2).max(100) }).parse(body);
      const result = await handOverLeavingCertificate(user, {
        studentId: params.id,
        handedOverTo,
      });
      return ok(result);
    }

    return fail("BAD_REQUEST", "Invalid action specified.", 400);
  } catch (err) {
    return handleError(err);
  }
}
