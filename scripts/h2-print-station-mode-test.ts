/** H.2 Boarding Term-End Print Scheduler — live test (self-healing). */
import { db } from "../src/lib/db";
import { queuedJobs, setPrintStationMode, queuePrint, PrintError } from "../src/lib/services/print-queue.service";
import type { SessionUser } from "../src/lib/core/session";

async function asUser(email: string) {
  return (await db.user.findFirstOrThrow({ where: { email } })) as unknown as SessionUser;
}

async function main() {
  const principal = await asUser("principal@karibuhigh.ac.ke");
  const bursar = await asUser("bursar@karibuhigh.ac.ke");      // not tenant.manage_settings
  const tenantId = principal.tenantId;
  const orig = (await db.tenant.findUnique({ where: { id: tenantId } }))?.printStationMode ?? "AUTO";

  let pass = 0, fail = 0;
  const ok = (c: boolean, l: string) => { if (c) { pass++; console.log("  ✓", l); } else { fail++; console.log("  ✗ FAIL:", l); } };

  // reset to AUTO
  await db.tenant.update({ where: { id: tenantId }, data: { printStationMode: "AUTO" } });

  // 1) default station mode reported as AUTO
  const board1 = await queuedJobs(principal);
  ok(board1.printStationMode === "AUTO", "queuedJobs reports AUTO by default");

  // 2) non-leadership cannot change mode
  try { await setPrintStationMode(bursar, "HOLD"); ok(false, "bursar set mode should be FORBIDDEN"); }
  catch (e: any) { ok(e instanceof PrintError && e.code === "FORBIDDEN", "bursar setPrintStationMode blocked (FORBIDDEN)"); }

  // 3) principal sets HOLD; persisted + reflected
  const set = await setPrintStationMode(principal, "HOLD");
  ok(set.printStationMode === "HOLD", "principal set HOLD");
  const board2 = await queuedJobs(principal);
  ok(board2.printStationMode === "HOLD", "queuedJobs now reports HOLD");

  // 4) jobs STILL queue while in HOLD (nothing is lost — just not auto-printed)
  const job = await queuePrint({
    tenantId, kind: "RECEIPT", refId: "test-hold-" + Date.now(),
    title: "Test receipt (HOLD)", url: "/api/payments/x/receipt", queuedBy: "Test",
  });
  const board3 = await queuedJobs(principal);
  ok(board3.jobs.some((j) => j.id === job.id), "job still queues in HOLD mode (held for term-end batch)");

  // 5) audit recorded
  const a = await db.auditLog.findFirst({ where: { action: "print.station_mode_changed" }, orderBy: { createdAt: "desc" } });
  ok(!!a && JSON.parse(a.metadata || "{}").mode === "HOLD", "mode change audited (print.station_mode_changed)");

  // 6) back to AUTO works
  const back = await setPrintStationMode(principal, "AUTO");
  ok(back.printStationMode === "AUTO", "principal set back to AUTO");

  // self-heal: remove the test job + restore original mode
  await db.printJob.delete({ where: { id: job.id } }).catch(() => {});
  await db.tenant.update({ where: { id: tenantId }, data: { printStationMode: orig } });

  console.log(`\n  ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
