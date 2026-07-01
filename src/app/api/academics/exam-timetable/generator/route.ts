import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { getExamTimetableGeneratorSetup, generateExamTimetableFromRules, previewExamTimetableGeneration, ExamTimetableGeneratorError } from "@/lib/services/exam-timetable-generator.service";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["preview", "generate"]).optional(),
  examName: z.string().optional(),
  classIds: z.array(z.string()).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  periods: z.array(z.object({
    label: z.string(),
    startTime: z.string(),
    endTime: z.string(),
  })).optional(),
  notes: z.string().optional().nullable(),
  autoGenerateInvigilators: z.boolean().optional(),
});

function mapErr(e: unknown) {
  if (e instanceof ExamTimetableGeneratorError) {
    const m = { NOT_FOUND: 404, INVALID: 400, CONFLICT: 409 } as const;
    return fail(e.code, e.message, m[e.code]);
  }
  return null;
}

export async function GET() {
  try {
    const user = await requirePermission("exam.manage");
    return ok(await getExamTimetableGeneratorSetup(user));
  } catch (e) {
    return mapErr(e) ?? handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("exam.manage");
    const body = schema.parse(await req.json());
    if (body.action === 'preview') return ok(await previewExamTimetableGeneration(user, body));
    return ok(await generateExamTimetableFromRules(user, body));
  } catch (e) {
    return mapErr(e) ?? handleError(e);
  }
}
