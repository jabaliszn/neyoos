/** B.8 payroll — live tests incl statutory math spot-checks. */
import { db } from "../src/lib/db";
import { grossToNet, payeTax, runPayroll, approveRun, runDetail, listRuns } from "../src/lib/services/payroll.service";
import type { SessionUser } from "../src/lib/core/session";

async function main() {
  const principal = (await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } })) as unknown as SessionUser;

  // 1) statutory spot-checks
  const g50 = grossToNet(50000);
  console.log("50k NSSF:", g50.nssfKes === 3000 ? "✓ 3,000 (480+2,520)" : "✗ " + g50.nssfKes);
  console.log("50k SHIF:", g50.shifKes === 1375 ? "✓ 1,375 (2.75%)" : "✗");
  console.log("50k AHL:", g50.housingLevyKes === 750 ? "✓ 750 (1.5%)" : "✗");
  console.log("24k PAYE (low earner):", grossToNet(24000).payeKes === 0 ? "✓ 0 after relief" : "✗");
  console.log("SHIF floor:", grossToNet(8000).shifKes === 300 ? "✓ min 300" : "✗");
  console.log("PAYE band edge 24k taxable:", payeTax(24000) === 0 ? "✓ 2400-2400=0" : "✗ " + payeTax(24000));

  // 2) run payroll w/ overtime for the class teacher
  const chebet = await db.user.findFirstOrThrow({ where: { role: "CLASS_TEACHER", tenantId: principal.tenantId } });
  const run = await runPayroll(principal, "2026-06", { [chebet.id]: 5000 });
  console.log("run created:", run.staff === 4 ? "✓ 4 staff" : "✗ " + run.staff);

  // 3) dup run blocked
  try { await runPayroll(principal, "2026-06"); console.log("dup run: ALLOWED ✗"); }
  catch { console.log("dup run blocked: ✓"); }

  // 4) detail: chebet has OT + her gross = 45k+14k+5k = 64k; net = gross - statutory - sacco
  const detail = await runDetail(principal, run.runId);
  const slip = detail.payslips.find(p => p.userId === chebet.id)!;
  console.log("chebet OT:", slip.overtimeKes === 5000 ? "✓ 5,000" : "✗", "| gross:", slip.grossKes === 64000 ? "✓ 64,000" : "✗ " + slip.grossKes);
  const expect = grossToNet(64000);
  console.log("chebet PAYE matches calculator:", slip.payeKes === expect.payeKes ? "✓ " + slip.payeKes : "✗");
  console.log("chebet net = statutory net - sacco:", slip.netKes === expect.netStatutoryKes - 2000 ? "✓ " + slip.netKes : "✗");

  // 5) approve locks
  await approveRun(principal, run.runId);
  try { await approveRun(principal, run.runId); console.log("re-approve: ALLOWED ✗"); }
  catch { console.log("re-approve blocked: ✓"); }

  // 6) totals
  const runs = await listRuns(principal);
  console.log("run totals:", runs[0].staffCount, "staff, gross", runs[0].grossKes, "net", runs[0].netKes, runs[0].grossKes > runs[0].netKes ? "✓ deductions applied" : "✗");

  // cleanup
  await db.payslip.deleteMany({ where: { runId: run.runId } });
  await db.payrollRun.delete({ where: { id: run.runId } });
  console.log("cleanup ✓");
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
