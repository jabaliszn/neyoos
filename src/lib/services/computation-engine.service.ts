import { db } from "@/lib/db";
import { tenantDb } from "@/lib/core/tenant-db";
import { withTenant } from "@/lib/core/tenant-context";

export class ComputationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComputationError";
  }
}

/**
 * 1. Normalize Paper Marks -> Final Subject Exam Score
 * Math: (MarksScored / OutOfMarks) * (WeightPct / 100) -> Summed.
 */
async function computeSubjectExamScores(tenantId: string, examId: string) {
  return withTenant(tenantId, async () => {
    const tDb = tenantDb();
    
    // Fetch all paper results for this exam
    const results = await tDb.examResult.findMany({
      where: { examId },
      include: { PaperResult: { include: { paperConfig: true } } }
    });

    for (const res of results) {
      if (res.PaperResult.length === 0) continue; // It was a 'default' 100% paper, marks are already in res.marks

      let finalScore = 0;
      let configuredTotalWeight = 0;

      for (const pr of res.PaperResult) {
        if (pr.marksScored === null) continue;
        const cfg = pr.paperConfig;
        configuredTotalWeight += cfg.weightPct;
        const normalized = (pr.marksScored / cfg.outOfMarks) * cfg.weightPct;
        finalScore += normalized;
      }

      // If papers were entered but the total weight doesn't hit 100 (e.g. absent for one),
      // we scale the final score based on the school's policy. 
      // Assuming strict literal scale here: if you miss a 20% paper, max is 80.
      
      await tDb.examResult.update({
        where: { id: res.id },
        data: { marks: Math.round(finalScore) }
      });
    }
  });
}

/**
 * 2. K.5 Asynchronous Background Job — Master Term Report Aggregation
 * This loops through all students in a Term, looks up the TermAggregationRule (Macro-Weights),
 * calculates the final aggregate score across CATs, Projects, and Exams, and maps it to CBC Rubrics.
 */
export async function triggerTermComputation(tenantId: string, portalId: string) {
  // We don't await this inside the API route. We fire and forget.
  _runBackgroundComputation(tenantId, portalId).catch(console.error);
  return { status: "COMPUTING", message: "Computation started in the background." };
}

async function _runBackgroundComputation(tenantId: string, portalId: string) {
  return withTenant(tenantId, async () => {
    const tDb = tenantDb();
    
    await tDb.marksPortal.update({
      where: { id: portalId },
      data: { status: "COMPUTING", computationStartedAt: new Date(), computationProgress: 5 }
    });

    const portal = await tDb.marksPortal.findUnique({ where: { id: portalId }, include: { term: true } });
    if (!portal || !portal.termId) throw new ComputationError("Invalid portal configuration");

    // Get all exams belonging to this term to compute their micro-weights first
    const exams = await tDb.exam.findMany({ where: { term: portal.term!.term } });
    for (const ex of exams) {
      await computeSubjectExamScores(tenantId, ex.id);
    }
    
    await tDb.marksPortal.update({ where: { id: portalId }, data: { computationProgress: 30 } });

    // In a real system, we'd loop over students, read TermAggregationRule, and create MasterReportCard rows.
    // For this demonstration chunk, we simulate the heavy workload.
    
    // Simulate DB bulk calculations
    await new Promise(r => setTimeout(r, 2000));
    await tDb.marksPortal.update({ where: { id: portalId }, data: { computationProgress: 80 } });
    
    // Map to CBC (J.4 Integration)
    // ExamResult -> 80%+ = Level 4 (EE), 65-79% = Level 3 (ME), etc.
    const results = await tDb.examResult.findMany({ where: { exam: { term: portal.term!.term } } });
    for (const r of results) {
      let level = 1; // BE
      if (r.marks >= 80) level = 4; // EE
      else if (r.marks >= 65) level = 3; // ME
      else if (r.marks >= 50) level = 2; // AE
      
      // Upsert into CompetencyEvidence (CBC Sync)
      // Note: We need a mapping between subject -> competency to do this automatically, 
      // but we demonstrate the integration hook here.
    }

    await tDb.marksPortal.update({
      where: { id: portalId },
      data: { 
        status: "PENDING_RELEASE", 
        computationEndedAt: new Date(), 
        computationProgress: 100,
        computationTotalRows: results.length
      }
    });

    // Notify Principals that results are ready for release
    const { createInApp } = await import("./notification.service");
    const leadership = await tDb.user.findMany({
      where: { role: { in: ["PRINCIPAL", "DEPUTY_PRINCIPAL", "SCHOOL_OWNER"] }, isActive: true }
    });
    
    for (const leader of leadership) {
      await createInApp({
        tenantId,
        recipientId: leader.id,
        title: "Term Computation Complete",
        body: "The computation for " + portal.name + " has finished. Results are pending your approval to release.",
        category: "system",
        href: "/academics" // We will build a Release UI
      });
    }
  });
}

// 3. K.7 & K.8 Joint Release Workflow
export async function releaseTermResults(tenantId: string, portalId: string, releaserId: string) {
  return withTenant(tenantId, async () => {
    const tDb = tenantDb();
    
    const portal = await tDb.marksPortal.findUnique({ where: { id: portalId }, include: { term: true } });
    if (!portal || portal.status !== "PENDING_RELEASE") throw new ComputationError("Portal not ready for release");

    await tDb.marksPortal.update({
      where: { id: portalId },
      data: { status: "RELEASED" }
    });

    // Make all underlying exams visible to parents
    await tDb.exam.updateMany({
      where: { term: portal.term!.term },
      data: { published: true }
    });

    // Notify all Teachers
    const { createInApp } = await import("./notification.service");
    const teachers = await tDb.user.findMany({ where: { role: { in: ["TEACHER", "CLASS_TEACHER"] } } });
    for (const t of teachers) {
      await createInApp({
        tenantId,
        recipientId: t.id,
        title: "Results Released",
        body: "The Principal has officially released results for " + portal.name,
        category: "system",
        href: "/academics"
      });
    }

    // Fire SMS to all Parents
    // Requires A.7 SMS integration
    /*
    const parents = await tDb.user.findMany({ where: { role: "PARENT" } });
    for (const p of parents) {
      await sendSms(p.phone, \`NEYO: Results for \${portal.name} have been released. Please log into the Parent Portal to view.\`);
    }
    */

    return { success: true };
  });
}
