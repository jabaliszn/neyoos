import { NextRequest } from "next/server";
import { requirePermission, requireRole } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { globalCurriculumTemplateSchema } from "@/lib/validations/global-curriculum";
import { getGlobalTemplates, upsertGlobalTemplate, deleteGlobalTemplate } from "@/lib/services/global-curriculum.service";

// NEYO OPS endpoint
export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("SUPER_ADMIN");
    const templates = await getGlobalTemplates(user, false);
    return ok({ data: templates });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("SUPER_ADMIN");
    const id = req.nextUrl.searchParams.get("id");
    const body = await req.json();
    const data = globalCurriculumTemplateSchema.parse(body);
    const template = await upsertGlobalTemplate(user, data, id || undefined);
    return ok({ data: template });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireRole("SUPER_ADMIN");
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return fail("INVALID", "Missing ID", 400);
    await deleteGlobalTemplate(user, id);
    return ok({ message: "Deleted" });
  } catch (error) {
    return handleError(error);
  }
}
