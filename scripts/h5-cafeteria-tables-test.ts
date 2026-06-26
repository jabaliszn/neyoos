/** H.5 Cafeteria Table Allocation — live test (self-healing). */
import { db } from "../src/lib/db";
import {
  allocateCafeteriaTables, tableBoard, clearCafeteriaTables, CafeteriaError,
} from "../src/lib/services/cafeteria.service";
import type { SessionUser } from "../src/lib/core/session";

async function asUser(email: string) {
  return (await db.user.findFirstOrThrow({ where: { email } })) as unknown as SessionUser;
}

async function main() {
  const principal = await asUser("principal@karibuhigh.ac.ke");
  const tenantId = principal.tenantId;
  let pass = 0, fail = 0;
  const ok = (c: boolean, l: string) => { if (c) { pass++; console.log("  ✓", l); } else { fail++; console.log("  ✗ FAIL:", l); } };

  // self-heal: clear any prior tables
  await db.cafeteriaTable.deleteMany({ where: { tenantId } });

  // 1) invalid table size rejected
  try { await allocateCafeteriaTables(principal, { session: "LUNCH", tableSize: 1 }); ok(false, "size 1 should be INVALID"); }
  catch (e: any) { ok(e instanceof CafeteriaError && e.code === "INVALID", "table size < 2 rejected (INVALID)"); }

  // 2) allocate LUNCH with size 2 (Karibu seed: F2E 3 students, F1W 2 students)
  const board = await allocateCafeteriaTables(principal, { session: "LUNCH", tableSize: 2 });
  ok(board.session === "LUNCH", "board session = LUNCH");
  ok(board.totalSeated > 0, `seated ${board.totalSeated} students across ${board.totalTables} tables`);

  // 3) no class mixing — every table belongs to exactly one class label
  const allByClass = board.classes;
  ok(allByClass.length >= 1, `tables grouped by ${allByClass.length} class(es)`);
  let noMix = true;
  for (const c of allByClass) {
    for (const t of c.tables) {
      if (t.students.length > 2) noMix = false; // size 2 → max 2 per table
    }
  }
  ok(noMix, "no table exceeds the chosen size (2) — students chunked correctly");

  // 4) per-class chunking: a 3-student class → 2 tables (2 + 1)
  const threeClass = allByClass.find((c) => c.tables.reduce((n, t) => n + t.students.length, 0) === 3);
  ok(!!threeClass && threeClass.tables.length === 2, "3-student class split into 2 tables (2 + 1)");

  // 5) tableBoard read-back matches
  const rb = await tableBoard(principal, "LUNCH");
  ok(rb.totalTables === board.totalTables && rb.totalSeated === board.totalSeated, "tableBoard read-back matches allocation");
  ok(rb.tableSize === 2, "school cafeteriaTableSize saved as 2");

  // 6) idempotent re-allocation (size 8) — replaces, doesn't stack
  const board8 = await allocateCafeteriaTables(principal, { session: "LUNCH", tableSize: 8 });
  const rowCount = await db.cafeteriaTable.count({ where: { tenantId, session: "LUNCH" } });
  ok(rowCount === board8.totalTables, `re-allocation replaced (not stacked): ${rowCount} rows = ${board8.totalTables} tables`);

  // 7) SUPPER is a separate session (independent of LUNCH)
  await allocateCafeteriaTables(principal, { session: "SUPPER", tableSize: 4 });
  const lunchRows = await db.cafeteriaTable.count({ where: { tenantId, session: "LUNCH" } });
  const supperRows = await db.cafeteriaTable.count({ where: { tenantId, session: "SUPPER" } });
  ok(lunchRows > 0 && supperRows > 0, `LUNCH (${lunchRows}) and SUPPER (${supperRows}) seating plans coexist`);

  // 8) audit recorded
  const a = await db.auditLog.findFirst({ where: { action: "cafeteria.tables_allocated" }, orderBy: { createdAt: "desc" } });
  ok(!!a, "allocation audited (cafeteria.tables_allocated)");

  // 9) clear
  const cleared = await clearCafeteriaTables(principal, "LUNCH");
  ok(cleared.cleared > 0 && (await db.cafeteriaTable.count({ where: { tenantId, session: "LUNCH" } })) === 0, "clear LUNCH removes its tables");

  // self-heal cleanup
  await db.cafeteriaTable.deleteMany({ where: { tenantId } });

  console.log(`\n  ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
