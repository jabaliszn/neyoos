import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import {
  getGlobalTemplates,
  adoptCurriculumTemplate,
  getTemplateUpdatesForSchool,
} from "@/lib/services/global-curriculum.service";
import { assertJFeatureEnabled } from "@/lib/services/platform-flags.service";

// SCHOOL TENANT endpoint. Gated by the NEYO Ops J.21 feature toggle.
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("academics.view");
    await assertJFeatureEnabled("J.21");

    // ?view=updates → which adopted templates have a newer published version.
    if (req.nextUrl.searchParams.get("view") === "updates") {
      const updates = await getTemplateUpdatesForSchool(user);
      return ok(updates);
    }

    const templates = await getGlobalTemplates(user, true); // Only PUBLISHED
    return ok(templates);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("academics.manage");
    await assertJFeatureEnabled("J.21");

    const body = await req.json();
    if (!body.templateId) return fail("INVALID", "Missing templateId.", 400);

    const draft = await adoptCurriculumTemplate(user, body.templateId);
    return ok(draft, 201);
  } catch (error) {
    return handleError(error);
  }
}
