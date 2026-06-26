/**
 * B.4 subjects. GET list (academics.view) · POST create / preset (academics.manage).
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { subjectSchema, KE_SUBJECT_PRESETS } from "@/lib/validations/academics";
import { listSubjects, createSubject, addSubjectPreset } from "@/lib/services/academics.service";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requirePermission("academics.view");
    return ok({ subjects: await listSubjects(user) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("academics.manage");
    const body = await req.json();
    if (body?.preset) {
      const { preset } = z.object({ preset: z.enum(["CBC", "8-4-4"]) }).parse(body);
      return ok(await addSubjectPreset(user, preset, KE_SUBJECT_PRESETS[preset]));
    }
    const input = subjectSchema.parse(body);
    return ok(await createSubject(user, input));
  } catch (e) {
    return handleError(e);
  }
}
