import { db } from "@/lib/db";
import { tenantDb } from "@/lib/core/tenant-db";
import { withTenant } from "@/lib/core/tenant-context";
import { SessionUser } from "@/lib/core/session";

export class GradingError extends Error {
  constructor(public code: "NOT_FOUND" | "FORBIDDEN" | "INVALID" | "CLOSED", message: string) {
    super(message);
    this.name = "GradingError";
  }
}

// 1. Get Subject Paper Configs
export async function getSubjectPaperConfigs(user: SessionUser, subjectId: string, classId?: string) {
  return withTenant(user.tenantId, async () => {
  const tDb = tenantDb();
  let configs = await tDb.subjectPaperConfig.findMany({
    where: { subjectId, classId: classId || null },
    orderBy: { name: "asc" }
  });

  // If no specific class config, fallback to global subject config
  if (configs.length === 0 && classId) {
    configs = await tDb.subjectPaperConfig.findMany({
      where: { subjectId, classId: null },
      orderBy: { name: "asc" }
    });
  }

  // If entirely unconfigured, return a default implicit configuration (out of 100, 100%)
  if (configs.length === 0) {
    return [{
      id: "default",
      tenantId: user.tenantId,
      subjectId,
      classId: null,
      name: "Main Paper",
      outOfMarks: 100,
      weightPct: 100
    }];
  }

  return configs;
  });
}

// 2. Setup/Update Subject Paper Configs
export async function configureSubjectPapers(user: SessionUser, subjectId: string, classId: string | null, papers: { name: string; outOfMarks: number; weightPct: number }[]) {
  return withTenant(user.tenantId, async () => {
  const tDb = tenantDb();
  
  if (user.role !== "SUPER_ADMIN" && user.role !== "PRINCIPAL" && user.role !== "DEPUTY_PRINCIPAL" && user.role !== "HOD") {
    throw new GradingError("FORBIDDEN", "Only academic leadership can configure paper weights.");
  }

  // Validate weights sum to 100
  const totalWeight = papers.reduce((sum, p) => sum + p.weightPct, 0);
  if (totalWeight !== 100) {
    throw new GradingError("INVALID", "Paper weights must sum to exactly 100%.");
  }

  await tDb.subjectPaperConfig.deleteMany({
    where: { subjectId, classId }
  });

  for (const p of papers) {
    await tDb.subjectPaperConfig.create({
      data: {
        tenantId: user.tenantId,
        subjectId,
        classId,
        name: p.name,
        outOfMarks: p.outOfMarks,
        weightPct: p.weightPct
      }
    });
  }

  return getSubjectPaperConfigs(user, subjectId, classId || undefined);
  });
}

// 3. Teacher Marks Entry Security Guard
export async function assertTeacherCanMark(user: SessionUser, classId: string, subjectId: string) {
  return withTenant(user.tenantId, async () => {
  // Principals / Admins can mark anything
  if (["PRINCIPAL", "DEPUTY_PRINCIPAL", "SUPER_ADMIN"].includes(user.role)) return true;

  const tDb = tenantDb();
  const teaches = await tDb.timetableSlot.findFirst({
    where: { classId, subjectId, teacherId: user.id }
  });

  if (!teaches) {
    throw new GradingError("FORBIDDEN", "You are not assigned to teach this subject to this class.");
  }

  return true;
  });
}

// 4. Enter Paper Marks
export async function savePaperResults(user: SessionUser, examId: string, subjectId: string, classId: string, results: { studentId: string, paperConfigId: string, marksScored: number | null }[]) {
  return withTenant(user.tenantId, async () => {
  const tDb = tenantDb();

  await assertTeacherCanMark(user, classId, subjectId);

  // Check portal status
  const exam = await tDb.exam.findUnique({ where: { id: examId } });
  if (!exam) throw new GradingError("NOT_FOUND", "Exam not found");

  const portal = await tDb.marksPortal.findFirst({
    where: { 
      term: { term: exam.term },
      status: "OPEN",
      closeDate: { gt: new Date() }
    }
  });

  // If a portal exists for this term, but no OPEN portal matches, we are locked
  const anyPortal = await tDb.marksPortal.findFirst({ where: { term: { term: exam.term } } });
  if (anyPortal && !portal) {
    throw new GradingError("CLOSED", "Marks entry portal is closed.");
  }

  // Fetch configs to validate outOfMarks
  const configs = await getSubjectPaperConfigs(user, subjectId, classId);
  const configMap = new Map(configs.map(c => [c.id, c]));

  for (const r of results) {
    // Basic validation
    const cfg = configMap.get(r.paperConfigId);
    if (cfg && r.marksScored !== null && r.marksScored > cfg.outOfMarks) {
      throw new GradingError("INVALID", "Marks scored (" + r.marksScored + ") cannot exceed maximum (" + cfg.outOfMarks + ") for " + cfg.name);
    }

    // Upsert the ExamResult first to link it
    const examResult = await tDb.examResult.upsert({
      where: { examId_studentId_subjectId: { examId, studentId: r.studentId, subjectId } },
      create: {
        tenantId: user.tenantId,
        examId,
        studentId: r.studentId,
        subjectId,
        marks: 0, // Master score will be computed later
        enteredById: user.id
      },
      update: {
        enteredById: user.id
      }
    });

    // We skip writing to DB if config is 'default' (meaning no actual SubjectPaperConfig rows exist) 
    // and just save directly to examResult.marks
    if (r.paperConfigId === "default") {
      await tDb.examResult.update({
        where: { id: examResult.id },
        data: { marks: r.marksScored !== null ? Math.round(r.marksScored) : 0 }
      });
      continue;
    }

    // Upsert PaperResult
    await tDb.paperResult.upsert({
      where: { tenantId_examResultId_paperConfigId: { tenantId: user.tenantId, examResultId: examResult.id, paperConfigId: r.paperConfigId } },
      create: {
        tenantId: user.tenantId,
        examResultId: examResult.id,
        paperConfigId: r.paperConfigId,
        marksScored: r.marksScored
      },
      update: {
        marksScored: r.marksScored
      }
    });
  }

  return { success: true, count: results.length };
  });
}

// 5. Get Grid Data for UI
export async function getMarksGrid(user: SessionUser, examId: string, subjectId: string, classId: string) {
  return withTenant(user.tenantId, async () => {
  const tDb = tenantDb();
  await assertTeacherCanMark(user, classId, subjectId);

  const students = await tDb.student.findMany({
    where: { classId, status: "ACTIVE" },
    orderBy: { firstName: "asc" }
  });

  const configs = await getSubjectPaperConfigs(user, subjectId, classId);
  const examResults = await tDb.examResult.findMany({
    where: { examId, subjectId, studentId: { in: students.map(s => s.id) } },
    include: { PaperResult: true }
  });

  const gridData = students.map(s => {
    const res = examResults.find(e => e.studentId === s.id);
    const papers: Record<string, number | null> = {};
    if (res) {
      if (configs.length === 1 && configs[0].id === "default") {
        papers["default"] = res.marks;
      } else {
        res.PaperResult.forEach(pr => {
          papers[pr.paperConfigId] = pr.marksScored;
        });
      }
    }
    return {
      studentId: s.id,
      studentName: s.firstName + " " + s.lastName,
      admissionNo: s.admissionNo,
      papers
    };
  });

  return { configs, gridData };
  });
}
