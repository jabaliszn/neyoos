/** B.9 HR — live tests. */
import { db } from "../src/lib/db";
import { staffDirectory, applyForLeave, decideLeave, leaveBalances, promoteStaff, addAppraisal, addDisciplinary, addTraining, staffFile, listPostings, setApplicationStatus } from "../src/lib/services/hr.service";
import type { SessionUser } from "../src/lib/core/session";

async function asUser(email: string) { return (await db.user.findFirstOrThrow({ where: { email } })) as unknown as SessionUser; }

async function main() {
  const principal = await asUser("principal@karibuhigh.ac.ke");
  const chebet = await asUser("f.chebet@karibuhigh.ac.ke");

  // 1) directory + seeded profile
  const dir = await staffDirectory(principal);
  const chebetRow = dir.find(d => d.name.includes("Chebet"))!;
  console.log("directory:", dir.length, "staff | chebet TSC:", chebetRow.tscNumber === "TSC/584211" ? "✓" : "✗");

  // 2) leave: apply -> balance check -> over-balance blocked
  const leave = await applyForLeave(chebet, { type: "ANNUAL", startDate: "2026-08-03", endDate: "2026-08-07", reason: "Family" });
  console.log("leave applied:", leave.days === 5 ? "✓ 5 days" : "✗");
  try { await applyForLeave(chebet, { type: "PATERNITY", startDate: "2026-01-01", endDate: "2026-03-01" }); console.log("over-balance: ALLOWED ✗"); }
  catch (e) { console.log("over-balance blocked: ✓", (e as Error).message.slice(0, 50)); }

  // 3) self-approval blocked; principal approves -> balance reduced + calendar event
  try { await decideLeave(chebet, leave.id, true); console.log("self-approve: ALLOWED ✗"); }
  catch { console.log("self-approve blocked: ✓"); }
  await decideLeave(principal, leave.id, true);
  const bal = await leaveBalances(principal, chebet.id);
  const annual = bal.find(b => b.type === "ANNUAL")!;
  console.log("balance after approval:", annual.remaining === 25 ? "✓ 25/30 left" : "✗ " + annual.remaining);
  const calEvent = await db.calendarEvent.findFirst({ where: { title: { contains: "Chebet" } } });
  console.log("calendar event created:", calEvent ? "✓ " + calEvent.title : "✗");
  try { await decideLeave(principal, leave.id, false); console.log("re-decide: ALLOWED ✗"); }
  catch { console.log("re-decide blocked: ✓"); }

  // 4) promotion w/ audit; self-promotion blocked
  const promo = await promoteStaff(principal, chebet.id, "HOD", "Promoted to HOD Mathematics");
  console.log("promotion:", promo.from === "CLASS_TEACHER" && promo.to === "HOD" ? "✓ CLASS_TEACHER->HOD" : "✗");
  try { await promoteStaff(principal, principal.id, "SCHOOL_OWNER"); console.log("self-promote: ALLOWED ✗"); }
  catch { console.log("self-promote blocked: ✓"); }
  await promoteStaff(principal, chebet.id, "CLASS_TEACHER", "revert test"); // restore

  // 5) appraisal + training + disciplinary -> staff file
  await addAppraisal(principal, { userId: chebet.id, period: "2026-T2", score: 4, strengths: "Excellent learner rapport" });
  await addTraining(principal, { userId: chebet.id, title: "CBC assessment workshop", provider: "KICD", date: "2026-05-12", durationDays: 2 });
  await addDisciplinary(principal, { userId: chebet.id, date: "2026-03-01", category: "VERBAL_WARNING", details: "Late twice in one week", actionTaken: "Verbal caution" });
  const file = await staffFile(principal, chebet.id);
  console.log("staff file:", file.appraisals.length >= 1 && file.training.length >= 1 && file.disciplinary.length >= 1 && file.leave.length >= 1 ? "✓ all sections" : "✗");

  // 6) recruitment pipeline status
  const postings = await listPostings(principal);
  const hassan = postings[0].applications.find(a => a.name.includes("Hassan"))!;
  await setApplicationStatus(principal, hassan.id, "INTERVIEWED");
  const after = await listPostings(principal);
  console.log("recruitment status:", after[0].applications.find(a => a.id === hassan.id)?.status === "INTERVIEWED" ? "✓" : "✗");

  // cleanup test artifacts (keep seeds)
  await db.leaveRequest.delete({ where: { id: leave.id } });
  if (calEvent) await db.calendarEvent.delete({ where: { id: calEvent.id } });
  await db.appraisal.deleteMany({ where: { userId: chebet.id } });
  await db.trainingRecord.deleteMany({ where: { userId: chebet.id } });
  await db.disciplinaryRecord.deleteMany({ where: { userId: chebet.id } });
  await db.jobApplication.update({ where: { id: hassan.id }, data: { status: "NEW" } });
  console.log("cleanup ✓");
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
