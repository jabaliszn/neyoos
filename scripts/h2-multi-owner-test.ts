/** H.2 Multi-Owner Support — joint approvals — live test (self-healing). */
import { db } from "../src/lib/db";
import {
  ownerCount, jointApprovalActive, ownersBoard, setJointApproval,
  requestOwnerApproval, decideOwnerApproval, OwnerApprovalError,
} from "../src/lib/services/owner-approval.service";
import type { SessionUser } from "../src/lib/core/session";

async function asUser(email: string) { return (await db.user.findFirstOrThrow({ where: { email } })) as unknown as SessionUser; }

async function main() {
  const tenant = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  const tenantId = tenant.id;
  let pass = 0, fail = 0;
  const ok = (c: boolean, l: string) => { if (c) { pass++; console.log("  ✓", l); } else { fail++; console.log("  ✗ FAIL:", l); } };

  // Use the principal (make them owner #1 temporarily) + a created owner #2.
  const principal = await asUser("principal@karibuhigh.ac.ke");
  const bursar = await asUser("bursar@karibuhigh.ac.ke");

  // record originals to restore
  const origPolicy = tenant.requireJointOwnerApproval;
  const origPrincipalRole = principal.role;

  // make principal an OWNER (owner #1) and create owner #2
  await db.user.update({ where: { id: principal.id }, data: { role: "SCHOOL_OWNER" } });
  const owner2 = await db.user.create({
    data: {
      tenantId, neyoLoginId: "NEYO-TEST-OWNER2", fullName: "Co-Owner Test", role: "SCHOOL_OWNER",
      email: "coowner.test@karibuhigh.ac.ke", phone: "+254700000999", isActive: true,
    },
  });
  const ownerA = (await db.user.findUniqueOrThrow({ where: { id: principal.id } })) as unknown as SessionUser;
  const ownerB = (await db.user.findUniqueOrThrow({ where: { id: owner2.id } })) as unknown as SessionUser;

  // 1) owner count = 2
  ok((await ownerCount(tenantId)) >= 2, "ownerCount >= 2 (multiple registered owners)");

  // 2) bursar (not owner) cannot set policy
  try { await setJointApproval(bursar, true); ok(false, "bursar set policy should be FORBIDDEN"); }
  catch (e: any) { ok(e instanceof OwnerApprovalError && e.code === "FORBIDDEN", "non-owner setJointApproval blocked (FORBIDDEN)"); }

  // 3) owner turns ON joint approval
  await setJointApproval(ownerA, true);
  ok((await jointApprovalActive(tenantId)) === true, "joint approval active (flag ON + 2 owners)");

  // 4) owner A raises a critical request
  const reqRow = await requestOwnerApproval(ownerA, { action: "PERMANENT_DELETE", summary: "Purge 3 archived student records" });
  ok(reqRow.status === "PENDING", "owner A raised a PENDING joint-approval request");

  // 5) board shows it pending + owners list
  const board = await ownersBoard(ownerB);
  ok(board.ownerCount >= 2 && board.pending.some((r) => r.id === reqRow.id), "board lists owners + the pending request");

  // 6) SAME owner cannot self-approve (dual control)
  try { await decideOwnerApproval(ownerA, reqRow.id, true); ok(false, "self-approval should be blocked"); }
  catch (e: any) { ok(e?.code === "SELF", "initiator cannot self-approve (SELF — second owner required)"); }

  // 7) bursar cannot decide
  try { await decideOwnerApproval(bursar, reqRow.id, true); ok(false, "bursar decide should be FORBIDDEN"); }
  catch (e: any) { ok(e?.code === "FORBIDDEN", "non-owner cannot decide (FORBIDDEN)"); }

  // 8) the OTHER owner approves
  const decided = await decideOwnerApproval(ownerB, reqRow.id, true, "Confirmed with the board");
  ok(decided.status === "APPROVED" && decided.decidedById === ownerB.id, "second owner approved → APPROVED + logged");

  // 9) cannot re-decide
  try { await decideOwnerApproval(ownerB, reqRow.id, false); ok(false, "re-decide should be blocked"); }
  catch (e: any) { ok(e?.code === "STATE", "already-decided request cannot be re-decided (STATE)"); }

  // 10) confirmation log (audit)
  const a = await db.auditLog.findFirst({ where: { action: "owner.approval_granted" }, orderBy: { createdAt: "desc" } });
  ok(!!a, "joint approval logged (owner.approval_granted)");

  // 11) single-owner safety: with only 1 owner, jointApprovalActive is false even with flag ON
  await db.user.update({ where: { id: owner2.id }, data: { isActive: false } });
  ok((await jointApprovalActive(tenantId)) === false, "single owner → joint approval auto-inactive (won't block a 1-owner school)");

  // self-heal: delete owner2, restore principal role + policy + requests
  await db.ownerApprovalRequest.deleteMany({ where: { tenantId, requestedById: { in: [principal.id, owner2.id] } } });
  await db.user.delete({ where: { id: owner2.id } });
  await db.user.update({ where: { id: principal.id }, data: { role: origPrincipalRole } });
  await db.tenant.update({ where: { id: tenantId }, data: { requireJointOwnerApproval: origPolicy } });

  console.log(`\n  ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
