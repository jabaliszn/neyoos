/**
 * G.18 Whole-School Timetable Generator API.
 * GET  /api/academics/timetable/generator          - fetches classes, subjects, teachers, configs, needs matrices
 * POST /api/academics/timetable/generator          - handles actions (save_need, save_config, save_teacher_subject, generate)
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError, fail } from "@/lib/api/respond";
import {
  getTimetableInputs, saveClassSubjectNeed, saveTimetableConfig,
  saveTeacherSubjects, generateWholeSchoolTimetable, autoAssignTeachersToClasses,
} from "@/lib/services/timetable-solver.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requirePermission("academics.view");
    const result = await getTimetableInputs(user);
    return ok(result);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("academics.manage");
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (action === "save_need") {
      const result = await saveClassSubjectNeed(user, {
        classId: body.classId,
        subjectId: body.subjectId,
        lessonsPerWeek: Number(body.lessonsPerWeek),
        teacherId: body.teacherId || null,
        doubleCount: body.doubleCount !== undefined ? Number(body.doubleCount) : undefined,
        allowSplitDouble: body.allowSplitDouble !== undefined ? Boolean(body.allowSplitDouble) : undefined,
      });
      return ok(result);
    }

    if (action === "save_config") {
      const result = await saveTimetableConfig(user, {
        classId: body.classId,
        periodsPerDay: Number(body.periodsPerDay || 8),
        freePeriodsPerWeek: Number(body.freePeriodsPerWeek || 0),
        coCurricularCount: Number(body.coCurricularCount || 0),
        coCurricularName: body.coCurricularName || "Games",
        schoolDayStartTime: typeof body.schoolDayStartTime === "string" ? body.schoolDayStartTime : "08:00",
        saturdayStartTime: typeof body.saturdayStartTime === "string" ? body.saturdayStartTime : "08:00",
        saturdayEndTime: typeof body.saturdayEndTime === "string" ? body.saturdayEndTime : "12:40",
        lessonDurationMins: Number(body.lessonDurationMins || 40),
        shortBreakStart: Number(body.shortBreakStart || 2),
        shortBreakMins: Number(body.shortBreakMins || 15),
        longBreakStart: Number(body.longBreakStart || 4),
        longBreakMins: Number(body.longBreakMins || 30),
        lunchStart: Number(body.lunchStart || 6),
        lunchMins: Number(body.lunchMins || 60),
        hasRemedials: Boolean(body.hasRemedials),
        hasPreps: Boolean(body.hasPreps),
        lunchShift: Number(body.lunchShift || 1),
        hasSaturday: Boolean(body.hasSaturday !== undefined ? body.hasSaturday : true),
      });
      return ok(result);
    }

    if (action === "save_teacher_subject") {
      const result = await saveTeacherSubjects(user, body.teacherId, (body.subjectIds as any[]).map(s => typeof s === "string" ? { id: s, isStrong: false } : s));
      return ok(result);
    }

    if (action === "generate") {
      const result = await generateWholeSchoolTimetable(user);
      return ok(result);
    }

    return fail("BAD_REQUEST", "Invalid action specified.", 400);
  } catch (e) {
    return handleError(e);
  }
}
