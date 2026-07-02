import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { getDocumentDesign, saveDocumentDesign } from "@/lib/services/document-design.service";

export const dynamic = "force-dynamic";

const schema = z.object({
  idCardWidthMm: z.coerce.number().int().min(45).max(120),
  idCardHeightMm: z.coerce.number().int().min(45).max(160),
  idTemplate: z.enum(["emerald", "frost", "navy"]),
  documentTemplate: z.enum(["classic", "modern", "compact"]),
  smallTimetableLogo: z.boolean(),
  poweredByNeyo: z.boolean(),
  idStampEnabled: z.boolean().default(false),
});

export async function GET() {
  try {
    const user = await requirePermission("student.view");
    return ok(await getDocumentDesign(user.tenantId));
  } catch (error) { return handleError(error); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("tenant.manage_settings");
    return ok(await saveDocumentDesign(user, schema.parse(await req.json())));
  } catch (error) { return handleError(error); }
}
