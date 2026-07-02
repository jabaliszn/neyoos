import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { getFieldTemplate, saveFieldTemplate } from "@/lib/services/bundi-import.service";
import { saveFieldTemplateSchema } from "@/lib/validations/bundi-import";

export const dynamic = "force-dynamic";

/** GET /api/bundi-import/field-template — the school's own saved register-field description. */
export async function GET() {
  try {
    const user = await requirePermission("student.create");
    const result = await getFieldTemplate(user);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/bundi-import/field-template — save/update the description. */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("student.create");
    const input = saveFieldTemplateSchema.parse(await req.json().catch(() => ({})));
    const result = await saveFieldTemplate(user, input);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
