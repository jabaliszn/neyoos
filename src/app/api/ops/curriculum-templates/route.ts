import { NextRequest } from "next/server";
import { requireRole } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { globalCurriculumTemplateSchema } from "@/lib/validations/global-curriculum";
import {
  getGlobalTemplates,
  upsertGlobalTemplate,
  deleteGlobalTemplate,
  announceTemplateUpdate,
} from "@/lib/services/global-curriculum.service";

// NEYO OPS endpoint (SUPER_ADMIN). Manages company-level curriculum templates.
export async function GET() {
  try {
    const user = await requireRole("SUPER_ADMIN");
    const templates = await getGlobalTemplates(user, false);
    return ok(templates);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("SUPER_ADMIN");
    const id = req.nextUrl.searchParams.get("id");
    const action = req.nextUrl.searchParams.get("action");
    const body = await req.json();

    // Announce a new/updated version so schools see "update available".
    if (action === "announce") {
      if (!id) return fail("INVALID", "Missing template id.", 400);
      const announced = await announceTemplateUpdate(user, id, body?.changeNote ?? "");
      return ok(announced);
    }

    const data = globalCurriculumTemplateSchema.parse(body);
    const template = await upsertGlobalTemplate(user, data, id || undefined);
    return ok(template);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireRole("SUPER_ADMIN");
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return fail("INVALID", "Missing id.", 400);
    await deleteGlobalTemplate(user, id);
    return ok({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
