/** H.2 Customized Printing Limits — live test (self-healing). */
import { db } from "../src/lib/db";
import {
  assertCanPrint, recordPrint, setPrintLimit, requestPrintApproval,
  decidePrintApproval, printApprovalBoard, printsToday, isPrivilegedPrinter,
  PrintLimitError,
} from "../src/lib/services/print-limits.service";
import type { SessionUser } from "../src/lib/core/session";

async function asUser(email: string) {
  return (await db.user.findFirstOrThrow({ where: { email } })) as unknown as SessionUser;
}
function dayKey(userId: string) {
  return `${new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10)}`;
}

async function main() {
  const principal = await asUser("principal@karibuhigh.ac.ke");
  const bursar = await asUser("bursar@karibuhigh.ac.ke");     // non-privileged staff
  const parent = await asUser("parent@karibuhigh.ac.ke");      // exempt family
  const tenantId = principal.tenantId;

  let pass = 0, fail = 0;
  const ok = (c: boolean, l: string) => { if (c) { pass++; console.log("  ✓", l); } else { fail++; console.log("  ✗ FAIL:", l); } };

  // clean any prior counters/requests for these users (self-heal)
  await db.usageCounter.deleteMany({ where: { tenantId, metric: { in: [`print:${bursar.id}`, `print:${parent.id}`] } } });
  await db.printApprovalRequest.deleteMany({ where: { tenantId, requestedById: bursar.id } });
  const origLimit = (await db.tenant.findUnique({ where: { id: tenantId } }))?.printLimitPerDay ?? 0;

  // 0) role classification
  ok(isPrivilegedPrinter(principal) === true, "principal is privileged printer");
  ok(isPrivilegedPrinter(bursar) === false, "bursar is NOT privileged");

  // 1) non-privileged cannot set the limit
  try { await setPrintLimit(bursar, 2); ok(false, "bursar setting limit should be FORBIDDEN"); }
  catch (e: any) { ok(e?.code === "FORBIDDEN", "bursar setPrintLimit blocked (FORBIDDEN)"); }

  // 2) principal sets a limit of 2/day
  const set = await setPrintLimit(principal, 2);
  ok(set.printLimitPerDay === 2, "principal set print limit to 2/day");

  // 3) bursar prints twice OK (within limit), counted
  await assertCanPrint(bursar, "INVOICE", "inv1"); await recordPrint(bursar);
  await assertCanPrint(bursar, "INVOICE", "inv2"); await recordPrint(bursar);
  ok((await printsToday(tenantId, bursar.id)) === 2, "bursar printsToday = 2");

  // 4) 3rd print blocked with LIMIT_REACHED
  try { await assertCanPrint(bursar, "INVOICE", "inv3"); ok(false, "3rd print should be LIMIT_REACHED"); }
  catch (e: any) { ok(e instanceof PrintLimitError && e.code === "LIMIT_REACHED", "3rd print blocked (LIMIT_REACHED)"); }

  // 5) bursar requests approval; principal sees it pending
  const reqRow = await requestPrintApproval(bursar, { docKind: "INVOICE", docRef: "inv3", reason: "Parent at the desk needs it" });
  ok(reqRow.status === "PENDING", "bursar raised PENDING approval request");
  const board = await printApprovalBoard(principal);
  ok(board.pending.some((r) => r.id === reqRow.id), "principal board shows the pending request");
  ok(board.printLimitPerDay === 2, "board reports current limit 2");

  // 6) duplicate request returns the same pending row (no stacking)
  const dup = await requestPrintApproval(bursar, { docKind: "INVOICE", docRef: "inv3" });
  ok(dup.id === reqRow.id, "duplicate request reuses the same pending row");

  // 7) non-privileged cannot decide
  try { await decidePrintApproval(bursar, reqRow.id, true); ok(false, "bursar deciding should be FORBIDDEN"); }
  catch (e: any) { ok(e?.code === "FORBIDDEN", "bursar decide blocked (FORBIDDEN)"); }

  // 8) principal approves → bursar can print once more (approval consumed → USED)
  await decidePrintApproval(principal, reqRow.id, true);
  const consumed = await assertCanPrint(bursar, "INVOICE", "inv3");
  ok(consumed.usedApproval === true, "approved request lets bursar print once (approval consumed)");
  const afterReq = await db.printApprovalRequest.findUnique({ where: { id: reqRow.id } });
  ok(afterReq?.status === "USED", "approval marked USED after consumption");

  // 9) and the next over-limit print is blocked again (approval was single-use)
  try { await assertCanPrint(bursar, "INVOICE", "inv4"); ok(false, "should block again after approval used"); }
  catch (e: any) { ok(e?.code === "LIMIT_REACHED", "blocked again after single-use approval consumed"); }

  // 10) PARENT (family) is exempt — never limited even at limit 2
  await db.usageCounter.create({ data: { tenantId, metric: `print:${parent.id}`, periodKey: dayKey(parent.id), used: 99 } });
  const parentCheck = await assertCanPrint(parent, "REPORT_CARD", "rc1");
  ok(parentCheck.usedApproval === false, "parent exempt from print limit");
  await recordPrint(parent);
  ok((await printsToday(tenantId, parent.id)) === 99, "parent print count NOT incremented (exempt)");

  // 11) limit 0 = unlimited
  await setPrintLimit(principal, 0);
  const unlimited = await assertCanPrint(bursar, "INVOICE", "infinite");
  ok(unlimited.usedApproval === false, "limit 0 = unlimited (no block)");

  // self-heal: restore original limit + clean test rows
  await setPrintLimit(principal, origLimit);
  await db.usageCounter.deleteMany({ where: { tenantId, metric: { in: [`print:${bursar.id}`, `print:${parent.id}`] } } });
  await db.printApprovalRequest.deleteMany({ where: { tenantId, requestedById: bursar.id } });

  console.log(`\n  ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
