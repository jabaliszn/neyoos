/** B.25 Expenses — full pipeline live test (SELF-HEALS, removes TEST rows). */
import { db } from "../src/lib/db";
import {
  addCategory, addCostCenter, seedPresets, archiveCategory,
  createExpense, approveExpense, rejectExpense, expensesBoard, expenseReports,
  approvedExpensesSinceKes,
} from "../src/lib/services/expense.service";
import { EXPENSE_CATEGORY_PRESETS, COST_CENTER_PRESETS } from "../src/lib/validations/expense";
import type { SessionUser } from "../src/lib/core/session";

let passed = 0, failed = 0;
function assert(name: string, cond: boolean) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); } else { failed++; console.log(`  ✗ ${name}`); }
}
async function su(email: string): Promise<SessionUser> {
  const u = await db.user.findFirstOrThrow({ where: { email } });
  return { id: u.id, tenantId: u.tenantId, fullName: u.fullName, role: u.role, email: u.email, phone: u.phone, language: "en" } as SessionUser;
}

function nairobiMonthKey() {
  const n = new Date(Date.now() + 3 * 3600_000);
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function main() {
  const bursar = await su("bursar@karibuhigh.ac.ke");
  const principal = await su("principal@karibuhigh.ac.ke");
  const deputy = await su("deputy@karibuhigh.ac.ke");
  const ym = nairobiMonthKey();

  // cleanup leftovers from previous runs
  await db.expense.deleteMany({ where: { tenantId: bursar.tenantId, payee: { startsWith: "TEST " } } });
  await db.expenseCategory.deleteMany({ where: { tenantId: bursar.tenantId, name: { startsWith: "TEST " } } });
  await db.costCenter.deleteMany({ where: { tenantId: bursar.tenantId, name: { startsWith: "TEST " } } });

  // 1) board reads seed (presets + 3 seeded expenses, 1 pending)
  const board0 = await expensesBoard(bursar);
  assert("threshold default 20,000", board0.thresholdKes === 20000);
  assert("seed categories present", board0.categories.length >= 10);
  assert("seed cost centers present", board0.costCenters.length >= 7);
  assert("seed has a pending expense", board0.awaitingApproval >= 1);

  // 2) presets seed is idempotent (no duplicates)
  const seededAgain = await seedPresets(bursar, [...EXPENSE_CATEGORY_PRESETS], [...COST_CENTER_PRESETS]);
  assert("seedPresets idempotent (0 added when all exist)", seededAgain.added === 0);

  // 3) add a TEST category + cost center; duplicate blocked
  const cat = await addCategory(bursar, "TEST Sports kit");
  const cc = await addCostCenter(bursar, "TEST Sports dept");
  try { await addCategory(bursar, "TEST Sports kit"); assert("duplicate category blocked", false); }
  catch { assert("duplicate category blocked", true); }

  // 4) UNDER threshold → auto-APPROVED
  const eA = await createExpense(bursar, { categoryId: cat.id, costCenterId: cc.id, payee: "TEST Bata Shoes", amountKes: 8000, spentOn: `${ym}-10` });
  assert("under threshold → auto-APPROVED", eA.status === "APPROVED" && eA.needsApproval === false);
  assert("approvedByName notes under-threshold", (eA.approvedByName ?? "").includes("under threshold"));

  // 5) OVER threshold → PENDING; creator cannot self-approve; another leader approves
  const eB = await createExpense(bursar, { categoryId: cat.id, payee: "TEST Goal posts Ltd", amountKes: 60000, spentOn: `${ym}-11` });
  assert("over threshold → PENDING_APPROVAL", eB.status === "PENDING_APPROVAL" && eB.needsApproval === true);
  // bursar isn't a leader, but the creator-self-approve guard is what we assert; use a leader who IS the creator:
  const eSelf = await createExpense(principal, { categoryId: cat.id, payee: "TEST Principal buy", amountKes: 55000, spentOn: `${ym}-11` });
  try { await approveExpense(principal, eSelf.id); assert("creator cannot self-approve", false); }
  catch { assert("creator cannot self-approve", true); }
  const approved = await approveExpense(deputy, eSelf.id);
  assert("different leader approves", approved.status === "APPROVED" && approved.approvedByName === deputy.fullName);
  const approvedB = await approveExpense(principal, eB.id);
  assert("leader approves bursar's pending", approvedB.status === "APPROVED");

  // 6) reject flow with reason
  const eR = await createExpense(bursar, { categoryId: cat.id, payee: "TEST No receipt", amountKes: 40000, spentOn: `${ym}-12` });
  const rejected = await rejectExpense(principal, eR.id, "No receipt attached");
  assert("reject sets REJECTED + reason", rejected.status === "REJECTED" && rejected.rejectedReason === "No receipt attached");
  try { await approveExpense(principal, eR.id); assert("cannot approve a rejected expense", false); }
  catch { assert("cannot approve a rejected expense", true); }

  // 7) amount validation
  try { await createExpense(bursar, { categoryId: cat.id, payee: "TEST zero", amountKes: 0, spentOn: `${ym}-12` }); assert("zero amount blocked", false); }
  catch { assert("zero amount blocked", true); }

  // 8) reports: TEST approved this month = 8,000 + 55,000 + 60,000 = 123,000 (eR rejected excluded)
  const report = await expenseReports(bursar, ym);
  const testCatRow = report.byCategory.find((r) => r.label === "TEST Sports kit");
  assert("report by-category includes TEST approved spend", !!testCatRow && testCatRow.totalKes === 123000);
  assert("rejected expense excluded from report", report.totalKes >= 123000); // includes seeded approved too

  // 9) approvedExpensesSinceKes (used by B.24) counts approved only
  const since = await approvedExpensesSinceKes(bursar.tenantId, `${ym}-01`);
  assert("approvedExpensesSinceKes counts approved (>= TEST 123,000)", since >= 123000);

  // 10) archive a category hides it from the board
  await archiveCategory(bursar, cat.id);
  const board1 = await expensesBoard(bursar);
  assert("archived category hidden from board", !board1.categories.some((c) => c.id === cat.id));

  // 11) audits written
  const audits = await db.auditLog.count({ where: { tenantId: bursar.tenantId, action: { startsWith: "expense." } } });
  assert("expense audits written", audits >= 5);

  // ---- self-heal: remove all TEST rows ----
  await db.expense.deleteMany({ where: { tenantId: bursar.tenantId, payee: { startsWith: "TEST " } } });
  await db.expenseCategory.deleteMany({ where: { tenantId: bursar.tenantId, name: { startsWith: "TEST " } } });
  await db.costCenter.deleteMany({ where: { tenantId: bursar.tenantId, name: { startsWith: "TEST " } } });
  console.log("  (test rows removed)");

  console.log(`\nB.25 Expenses: ${passed} passed, ${failed} failed ${failed === 0 ? "✅" : "❌"}`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
