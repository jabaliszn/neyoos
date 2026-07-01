import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { analyseTeacherTransferImpact, applyTeacherTransferReplacement, listTeacherTransferImpacts, TeacherTransferImpactError } from "@/lib/services/l7-teacher-transfer-impact.service";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["analyse", "apply"]),
  teacherId: z.string().optional(),
  reason: z.string().optional(),
  impactId: z.string().optional(),
  replacementTeacherId: z.string().optional(),
});

function mapErr(e: unknown) {
  if (e instanceof TeacherTransferImpactError) {
    const m = { NOT_FOUND: 404, INVALID: 400, CONFLICT: 409 } as const;
    return fail(e.code, e.message, m[e.code]);
  }
  return null;
}

export async function GET() {
  try {
    const user = await requirePermission("class.manage");
    return ok(await listTeacherTransferImpacts(user));
  } catch (e) {
    return mapErr(e) ?? handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("class.manage");
    const body = schema.parse(await req.json());
    if (body.action === 'analyse') return ok(await analyseTeacherTransferImpact(user, body.teacherId || '', body.reason));
    return ok(await applyTeacherTransferReplacement(user, body.impactId || '', body.replacementTeacherId));
  } catch (e) {
    return mapErr(e) ?? handleError(e);
  }
}
