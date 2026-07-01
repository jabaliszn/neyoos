import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { listExamTimetableSetup, saveExamTimetableSlot, saveExamInvigilatorPool, generateExamInvigilators, deleteExamTimetableSlot, ExamTimetableEngineError } from "@/lib/services/exam-timetable-invigilator.service";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["save_slot", "save_invigilator_pool", "generate_invigilators", "delete_slot"]),
  id: z.string().optional(),
  classId: z.string().optional(),
  subjectId: z.string().optional(),
  paperConfigId: z.string().optional().nullable(),
  examName: z.string().optional(),
  paperName: z.string().optional().nullable(),
  examDate: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  venue: z.string().optional().nullable(),
  targetScope: z.string().optional(),
  targetIds: z.array(z.string()).optional(),
  notes: z.string().optional().nullable(),
  invigilatorScope: z.string().optional(),
  eligibleInvigilatorIds: z.array(z.string()).optional(),
  slotId: z.string().optional(),
});

function mapErr(e: unknown) {
  if (e instanceof ExamTimetableEngineError) {
    const m = { NOT_FOUND: 404, INVALID: 400, CONFLICT: 409 } as const;
    return fail(e.code, e.message, m[e.code]);
  }
  return null;
}

export async function GET() {
  try {
    const user = await requirePermission("exam.manage");
    return ok(await listExamTimetableSetup(user));
  } catch (e) {
    return mapErr(e) ?? handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("exam.manage");
    const body = schema.parse(await req.json());
    if (body.action === 'save_slot') return ok(await saveExamTimetableSlot(user, body));
    if (body.action === 'save_invigilator_pool') return ok(await saveExamInvigilatorPool(user, body as any));
    if (body.action === 'delete_slot') return ok(await deleteExamTimetableSlot(user, body.id || ''));
    return ok(await generateExamInvigilators(user, body.examName || ''));
  } catch (e) {
    return mapErr(e) ?? handleError(e);
  }
}
