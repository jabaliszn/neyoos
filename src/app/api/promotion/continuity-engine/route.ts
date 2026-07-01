import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { getContinuitySnapshot, saveContinuityPolicy, applyTeacherChangeWithImpact, ContinuityEngineError } from "@/lib/services/l7-continuity-engine.service";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["save_policy", "apply_change"]),
  classId: z.string(),
  subjectId: z.string().nullable().optional(),
  teacherId: z.string(),
  roleType: z.enum(["SUBJECT", "CLASS_TEACHER"]),
  locked: z.boolean().optional(),
  regenerateTimetable: z.boolean().optional(),
});

function mapErr(e: unknown) {
  if (e instanceof ContinuityEngineError) {
    const m = { NOT_FOUND: 404, INVALID: 400, CONFLICT: 409 } as const;
    return fail(e.code, e.message, m[e.code]);
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("class.manage");
    const level = req.nextUrl.searchParams.get("level") || "";
    return ok(await getContinuitySnapshot(user, level));
  } catch (e) {
    return mapErr(e) ?? handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("class.manage");
    const body = schema.parse(await req.json());
    if (body.action === "save_policy") return ok(await saveContinuityPolicy(user, body));
    return ok(await applyTeacherChangeWithImpact(user, body));
  } catch (e) {
    return mapErr(e) ?? handleError(e);
  }
}
