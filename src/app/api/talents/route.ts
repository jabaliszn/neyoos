import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { talentAreaSchema } from "@/lib/validations/talents";
import { getTalentAreas, createTalentArea, TalentError } from "@/lib/services/talent.service";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("academics.view");
    const areas = await getTalentAreas(user);
    return ok({ data: areas });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("academics.manage");
    const body = await req.json();
    const data = talentAreaSchema.parse(body);
    const area = await createTalentArea(user, data);
    return ok({ data: area }, 201);
  } catch (error) {
    if (error instanceof TalentError) {
      const statusMap = { NOT_FOUND: 404, FORBIDDEN: 403, INVALID: 400, CONFLICT: 409 };
      return fail(error.code, error.message, statusMap[error.code] as any);
    }
    if ((error as any).name === "ZodError") {
      return fail("INVALID", (error as any).errors[0].message, 400);
    }
    return handleError(error);
  }
}
