/**
 * B.6 strands. GET ?subjectId= (academics.view) · POST create/preset (academics.manage).
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { strandSchema, KICD_STRAND_PRESETS } from "@/lib/validations/cbc";
import { listStrands, createStrand, addStrandPreset } from "@/lib/services/cbc.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("academics.view");
    return ok({ strands: await listStrands(user, req.nextUrl.searchParams.get("subjectId") || undefined) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("academics.manage");
    const body = await req.json();
    if (body?.preset) {
      const { subjectId, presetCode } = z.object({ subjectId: z.string().min(1), presetCode: z.string().min(2), preset: z.literal(true) }).parse(body);
      const preset = KICD_STRAND_PRESETS[presetCode];
      if (!preset) return ok({ added: 0, skipped: 0 });
      return ok(await addStrandPreset(user, subjectId, preset));
    }
    return ok(await createStrand(user, strandSchema.parse(body)));
  } catch (e) {
    return handleError(e);
  }
}
