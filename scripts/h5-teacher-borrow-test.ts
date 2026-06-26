/** H.5 Teacher Book Borrowing — live test (self-healing). */
import { db } from "../src/lib/db";
import { issueBook, returnBook, billFineToInvoice, LibraryError } from "../src/lib/services/library.service";
import type { SessionUser } from "../src/lib/core/session";

async function asUser(email: string) {
  return (await db.user.findFirstOrThrow({ where: { email } })) as unknown as SessionUser;
}
function future(days: number) {
  return new Date(Date.now() + (days + 1) * 24 * 3600_000 + 3 * 3600_000).toISOString().slice(0, 10);
}

async function main() {
  const librarian = await asUser("library@karibuhigh.ac.ke");
  const chebet = await asUser("f.chebet@karibuhigh.ac.ke"); // CLASS_TEACHER (staff borrower)
  const parent = await asUser("parent@karibuhigh.ac.ke");
  const tenantId = librarian.tenantId;
  let pass = 0, fail = 0;
  const ok = (c: boolean, l: string) => { if (c) { pass++; console.log("  ✓", l); } else { fail++; console.log("  ✗ FAIL:", l); } };

  const book = await db.libraryBook.findFirstOrThrow({ where: { tenant: { slug: "karibu-high" } } });

  // self-heal: clear any test staff issues
  await db.bookIssue.deleteMany({ where: { tenantId, borrowerUserId: chebet.id } });

  // 1) teacher (staff) can borrow a book
  const issue = await issueBook(librarian, { bookId: book.id, staffUserId: chebet.id, dueDate: future(7) });
  ok(issue.borrowerType === "STAFF", "issue.borrowerType = STAFF");
  ok(issue.borrowerUserId === chebet.id && issue.studentId === null, "staff borrower linked, studentId null");
  ok(issue.studentName === chebet.fullName, "borrower name = staff name");
  ok(/^(TSC|NEYO|STAFF)/.test(issue.admissionNo), "staff library ID set (TSC/NEYO id): " + issue.admissionNo);

  // 2) cannot pass both student and staff (validation enforced at API; service: staff path wins only when staffUserId set)
  //    but a PARENT cannot borrow as staff
  try { await issueBook(librarian, { bookId: book.id, staffUserId: parent.id, dueDate: future(7) }); ok(false, "parent borrowing as staff should be INVALID"); }
  catch (e: any) { ok(e instanceof LibraryError && e.code === "INVALID", "parent cannot borrow on a staff ID (INVALID)"); }

  // 3) duplicate copy to same staff blocked
  try { await issueBook(librarian, { bookId: book.id, staffUserId: chebet.id, dueDate: future(7) }); ok(false, "dup staff copy should be blocked"); }
  catch (e: any) { ok(e?.code === "DUPLICATE", "duplicate copy to same staff blocked (DUPLICATE)"); }

  // 4) return works for staff issue
  const ret = await returnBook(librarian, { issueId: issue.id });
  ok(!!ret, "staff return works");

  // 5) staff fine cannot be billed to an invoice (no fee invoice for staff)
  //    force a fine to test the guard
  await db.bookIssue.update({ where: { id: issue.id }, data: { fineKes: 50, finePaid: false } });
  try { await billFineToInvoice(librarian, issue.id); ok(false, "staff fine to invoice should be blocked"); }
  catch (e: any) { ok(e?.code === "INVALID" && /cash/i.test(e.message), "staff fine NOT billable to invoice (cash only)"); }

  // 6) student borrowing still works (regression)
  const student = await db.student.findFirstOrThrow({ where: { tenant: { slug: "karibu-high" }, status: "ACTIVE" } });
  await db.bookIssue.deleteMany({ where: { tenantId, studentId: student.id, bookId: book.id, returnedAt: null } });
  const sIssue = await issueBook(librarian, { bookId: book.id, studentId: student.id, dueDate: future(7) });
  ok(sIssue.borrowerType === "STUDENT" && sIssue.studentId === student.id, "student borrowing still works (regression)");
  await db.bookIssue.delete({ where: { id: sIssue.id } });

  // self-heal
  await db.bookIssue.deleteMany({ where: { tenantId, borrowerUserId: chebet.id } });

  console.log(`\n  ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
