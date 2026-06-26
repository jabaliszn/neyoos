/** G.16 promotion + reshuffle — live tests. */
import { db } from "../src/lib/db";
import { promotionPlan, commitPromotion, undoRun, reshufflePlan, commitReshuffle, nextLevel, listRuns } from "../src/lib/services/promotion.service";
import type { SessionUser } from "../src/lib/core/session";

async function main() {
  const principal = (await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } })) as unknown as SessionUser;

  // 0) level parser
  console.log("nextLevel:", nextLevel("Form 1"), nextLevel("Form 4"), nextLevel("Grade 9"), nextLevel("PP 2"), nextLevel("Weird"), 
    nextLevel("Form 1")==="Form 2" && nextLevel("Form 4")==="graduate" && nextLevel("Grade 9")==="graduate" && nextLevel("PP 2")==="Grade 1" && nextLevel("Weird")===null ? "✓" : "✗ FAIL");

  // make a Form 4 class with 2 students to test graduation path
  const tenantId = principal.tenantId;
  const f4 = await db.schoolClass.create({ data: { tenantId, level: "Form 4", stream: "North", curriculum: "8-4-4" } });
  const s1 = await db.student.create({ data: { tenantId, admissionNo: "KH-TEST-F4A", firstName: "Test", lastName: "Senior", gender: "M", classId: f4.id } });
  const s2 = await db.student.create({ data: { tenantId, admissionNo: "KH-TEST-F4B", firstName: "Testa", lastName: "Seniora", gender: "F", classId: f4.id } });

  // snapshot before
  const before = await db.student.findMany({ where: { tenantId, status: "ACTIVE" }, select: { id: true, classId: true } });
  const beforeMap = new Map(before.map(s => [s.id, s.classId]));

  // 1) plan
  const plan = await promotionPlan(principal);
  const f4Step = plan.plan.find(p => p.from === "Form 4 North");
  const f1Step = plan.plan.find(p => p.from === "Form 1 West");
  console.log("plan: F4->graduate:", f4Step?.graduate ? "✓" : "✗", "| F1 West -> ", f1Step?.to, f1Step?.toExists === false ? "(will create) ✓" : "");

  // 2) commit
  const result = await commitPromotion(principal, 2026);
  console.log("commit:", result.summary, result.graduated === 2 ? "✓ 2 graduated" : "✗ grad=" + result.graduated);
  const grads = await db.student.findMany({ where: { id: { in: [s1.id, s2.id] } } });
  console.log("F4 students -> GRADUATED + year + label:", grads.every(g => g.status === "GRADUATED" && g.graduationYear === 2026 && g.finalClassLabel === "Form 4 North") ? "✓" : "✗ FAIL");
  const f2w = await db.schoolClass.findFirst({ where: { tenantId, level: "Form 2", stream: "West" } });
  console.log("Form 2 West auto-created:", f2w ? "✓" : "✗ FAIL");
  const kiprono = await db.student.findFirst({ where: { firstName: "Kiprono" } });
  console.log("Kiprono Form 1 West -> Form 2 West:", kiprono?.classId === f2w?.id ? "✓" : "✗ FAIL");

  // 3) undo restores EVERYTHING
  await undoRun(principal, result.runId);
  const after = await db.student.findMany({ where: { tenantId, id: { in: [...beforeMap.keys()] } }, select: { id: true, classId: true, status: true } });
  const allRestored = after.every(s => s.classId === beforeMap.get(s.id) && s.status === "ACTIVE");
  console.log("undo restores all classes+status:", allRestored ? "✓" : "✗ FAIL");
  try { await undoRun(principal, result.runId); console.log("double undo: ALLOWED ✗"); } catch { console.log("double undo blocked: ✓"); }

  // 4) reshuffle: create Form 2 West students so Form 2 has 2 streams w/ imbalance
  const f2e = await db.schoolClass.findFirstOrThrow({ where: { tenantId, level: "Form 2", stream: "East" } });
  const w1 = await db.student.create({ data: { tenantId, admissionNo: "KH-TEST-W1", firstName: "Wendy", lastName: "Atieno", gender: "F", classId: f2w!.id } });
  const resPlan = await reshufflePlan(principal, "Form 2", "size");
  const sizes = resPlan.streams.map(s => s.count);
  console.log("reshuffle preview sizes:", sizes.join("/"), Math.max(...sizes) - Math.min(...sizes) <= 1 ? "✓ balanced" : "✗ FAIL");
  const resCommit = await commitReshuffle(principal, "Form 2", "gender");
  console.log("reshuffle commit:", resCommit.summary);
  const runs = await listRuns(principal);
  console.log("history rows:", runs.length, runs.some(r => r.kind === "reshuffle") && runs.some(r => r.kind === "promotion") ? "✓ both kinds" : "✗");
  // undo reshuffle too
  await undoRun(principal, resCommit.runId);
  const w1back = await db.student.findUniqueOrThrow({ where: { id: w1.id } });
  console.log("reshuffle undo restored Wendy:", w1back.classId === f2w!.id ? "✓" : "✗ FAIL");

  // 5) CLASS_TEACHER blocked from API-level op (permission check is in route; verify can())
  const { can } = await import("../src/lib/core/permissions");
  console.log("CLASS_TEACHER class.manage:", can("CLASS_TEACHER", "class.manage") ? "✗ has it (review!)" : "✓ denied");

  // cleanup test entities
  await db.student.deleteMany({ where: { admissionNo: { in: ["KH-TEST-F4A", "KH-TEST-F4B", "KH-TEST-W1"] } } });
  await db.schoolClass.delete({ where: { id: f4.id } });
  // keep Form 2 West? remove if empty to restore seed state
  const f2wCount = await db.student.count({ where: { classId: f2w!.id } });
  if (f2wCount === 0) await db.schoolClass.delete({ where: { id: f2w!.id } });
  await db.promotionRun.deleteMany({ where: { tenantId } });
  console.log("cleanup ✓ (seed state restored)");
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
