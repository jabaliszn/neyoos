import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { getGlobalTemplates, adoptCurriculumTemplate } from "@/lib/services/global-curriculum.service";

// SCHOOL TENANT endpoint
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("academics.view");
    const templates = await getGlobalTemplates(user, true); // Only PUBLISHED
    return ok({ data: templates });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("academics.manage");
    const body = await req.json();
    if (!body.templateId) return fail("INVALID", "Missing templateId", 400);
    
    const draft = await adoptCurriculumTemplate(user, body.templateId);
    return ok({ data: draft }, 201);
  } catch (error) {
    return handleError(error);
  }
}
