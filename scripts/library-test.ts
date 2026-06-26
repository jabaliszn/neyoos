/** B.15 Library + G.19 Class Chat — live tests (service-level). */
import { db } from "../src/lib/db";
import {
  listBooks, addBook, findByBarcode, issueBook, returnBook, markFinePaid,
  openIssues, unpaidFines, readingHistory, computeFine, overdueDays,
  FINE_PER_DAY_KES, MAX_OPEN_ISSUES,
} from "../src/lib/services/library.service";
import { openClassChat } from "../src/lib/services/class-chat.service";
import { getMessages, sendMessage } from "../src/lib/services/messaging.service";
import type { SessionUser } from "../src/lib/core/session";

async function asUser(email: string) {
  return (await db.user.findFirstOrThrow({ where: { email } })) as unknown as SessionUser;
}

/** Reset library state to the exact seed shape (self-healing regression runs). */
async function resetLibrary(tenantId: string) {
  await db.bookIssue.deleteMany({ where: { tenantId } });
  await db.libraryBook.deleteMany({ where: { tenantId } });
  const { execSync } = await import("child_process");
  execSync("npm run db:seed", { cwd: process.cwd(), stdio: "pipe" });
}

async function main() {
  const preTenant = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  await resetLibrary(preTenant.id);

  const librarian = await asUser("library@karibuhigh.ac.ke").catch(() =>
    db.user.findFirstOrThrow({ where: { role: "LIBRARIAN" } }).then((u) => u as unknown as SessionUser));
  const parent = await asUser("parent@karibuhigh.ac.ke");
  const achieng = await asUser("achieng@karibuhigh.ac.ke");
  const chebet = await asUser("f.chebet@karibuhigh.ac.ke");
  const njoroge = await asUser("p.njoroge@karibuhigh.ac.ke");

  const t = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  const f2e = await db.schoolClass.findFirstOrThrow({ where: { tenantId: t.id, level: "Form 2", stream: "East" } });
  const f1w = await db.schoolClass.findFirstOrThrow({ where: { tenantId: t.id, level: "Form 1", stream: "West" } });
  const achiengSt = await db.student.findFirstOrThrow({ where: { tenantId: t.id, firstName: "Achieng" } });
  const kamauSt = await db.student.findFirstOrThrow({ where: { tenantId: t.id, firstName: "Kamau" } });

  // ===== FINE MATH (unit) =====
  console.log("fine math: 0 days =", computeFine("2099-01-01"), computeFine("2099-01-01") === 0 ? "✓" : "✗");
  // 2026-06-01 (Mon) -> 2026-06-08 (Mon) = 7 calendar days, 1 Sunday skipped = 6 chargeable
  const d = overdueDays("2026-06-01", "2026-06-08");
  console.log("fine math: Jun1->Jun8 =", d, "days (Sunday skipped)", d === 6 ? "✓" : "✗", "=", d * FINE_PER_DAY_KES, "KES");

  // ===== CATALOG =====
  const books = await listBooks(librarian);
  console.log("catalog:", books.length >= 4 ? `✓ ${books.length} books` : "✗");
  const riverSource = books.find((b) => b.title.includes("River"))!;
  console.log("availability:", riverSource.copiesOut === 1 && riverSource.copiesAvailable === 11 ? "✓ 11/12 (Achieng has one)" : "✗ " + JSON.stringify(riverSource));

  // duplicate ISBN blocked
  try { await addBook(librarian, { title: "Dup", isbn: "9789966882574", copiesTotal: 1 }); console.log("dup ISBN: ALLOWED ✗"); }
  catch { console.log("dup ISBN blocked: ✓"); }

  // ===== BARCODE =====
  const hit = await findByBarcode(librarian, "9789966564184");
  console.log("barcode lookup:", hit.title.includes("Blossoms") && hit.copiesAvailable === 9 ? "✓ Blossoms, 9/10 (Kamau overdue)" : "✗");
  console.log("barcode shows overdue holder:", hit.openIssues[0]?.fineSoFarKes > 0 ? `✓ fine so far ${hit.openIssues[0].fineSoFarKes} KES` : "✗");

  // ===== ISSUE RULES =====
  const kamusi = books.find((b) => b.title.includes("Kamusi"))!;
  const future = new Date(Date.now() + 3 * 3600_000 + 14 * 24 * 3600_000).toISOString().slice(0, 10);
  // duplicate copy to same student blocked
  try { await issueBook(librarian, { bookId: riverSource.id, studentId: achiengSt.id, dueDate: future }); console.log("dup copy: ALLOWED ✗"); }
  catch { console.log("dup copy to same student blocked: ✓"); }
  // past due date blocked
  try { await issueBook(librarian, { bookId: kamusi.id, studentId: achiengSt.id, dueDate: "2020-01-01" }); console.log("past due: ALLOWED ✗"); }
  catch { console.log("past due date blocked: ✓"); }
  // max 3 books: issue 2 more to Achieng (has 1), then a 4th must fail
  const klb = books.find((b) => b.title.includes("KLB"))!;
  const blossoms = books.find((b) => b.title.includes("Blossoms"))!;
  const i2 = await issueBook(librarian, { bookId: klb.id, studentId: achiengSt.id, dueDate: future });
  const i3 = await issueBook(librarian, { bookId: blossoms.id, studentId: achiengSt.id, dueDate: future });
  try { await issueBook(librarian, { bookId: kamusi.id, studentId: achiengSt.id, dueDate: future }); console.log("4th book: ALLOWED ✗"); }
  catch { console.log(`${MAX_OPEN_ISSUES}-book limit enforced: ✓`); }

  // ===== OPEN ISSUES + OVERDUE =====
  const open = await openIssues(librarian);
  const kamauRow = open.find((o) => o.studentName.includes("Kamau"))!;
  console.log("open issues:", open.length === 4 ? "✓ 4 out" : "✗ " + open.length);
  console.log("overdue flag + live fine:", kamauRow.overdue && kamauRow.fineSoFarKes >= 80 ? `✓ ${kamauRow.daysOverdue}d → ${kamauRow.fineSoFarKes} KES` : "✗ " + JSON.stringify(kamauRow));

  // ===== RETURN + FINE =====
  const ret = await returnBook(librarian, { issueId: kamauRow.id, finePaid: false });
  console.log("return computes fine:", ret.fineKes === kamauRow.fineSoFarKes ? `✓ ${ret.fineKes} KES recorded` : "✗");
  try { await returnBook(librarian, { issueId: kamauRow.id }); console.log("double return: ALLOWED ✗"); }
  catch { console.log("double return blocked: ✓"); }
  const fines = await unpaidFines(librarian);
  console.log("unpaid fines ledger:", fines.some((f) => f.studentName.includes("Kamau")) ? "✓ Kamau listed" : "✗");
  await markFinePaid(librarian, kamauRow.id);
  const fines2 = await unpaidFines(librarian);
  console.log("collect fine:", !fines2.some((f) => f.id === kamauRow.id) ? "✓ cleared" : "✗");

  // on-time return = no fine
  const retOnTime = await returnBook(librarian, { issueId: i3.id });
  console.log("on-time return:", retOnTime.fineKes === 0 && retOnTime.finePaid ? "✓ no fine" : "✗");

  // ===== READING HISTORY (family scoped) =====
  const hist = await readingHistory(parent, achiengSt.id);
  console.log("reading history (parent):", hist.length >= 3 ? `✓ ${hist.length} records` : "✗");
  try { await readingHistory(parent, kamauSt.id); console.log("other child history: ALLOWED ✗ LEAK"); }
  catch { console.log("other-family history blocked: ✓"); }

  // ===== G.19 CLASS CHAT =====
  const chat = await openClassChat(chebet, f2e.id);
  console.log("class chat created:", chat.conversationId ? `✓ "${chat.title}" (+${chat.added} members)` : "✗");
  // parent + student are members (sync added them)
  const sameForParent = await openClassChat(parent, f2e.id);
  console.log("one chat per class:", sameForParent.conversationId === chat.conversationId ? "✓ same conversation" : "✗");
  // chebet sends; achieng reads it
  await sendMessage(t.id, { id: chebet.id, fullName: chebet.fullName }, { conversationId: chat.conversationId, body: "Karibuni wazazi! Homework ya wikendi imewekwa kwenye portal." });
  const msgs = await getMessages(t.id, achieng.id, chat.conversationId);
  console.log("student reads group message:", msgs.messages.some((m: { body: string }) => m.body.includes("Karibuni wazazi")) ? "✓" : "✗");
  // njoroge (not in class) blocked
  try { await openClassChat(njoroge, f2e.id); console.log("njoroge join F2E chat: ALLOWED ✗"); }
  catch { console.log("njoroge join F2E chat blocked: ✓"); }
  // parent can't open another class's chat
  try { await openClassChat(parent, f1w.id); console.log("parent F1W chat: ALLOWED ✗"); }
  catch { console.log("parent other-class chat blocked: ✓"); }

  // ===== cleanup test rows (keep seed: Achieng's set book + Kamau's returned fine) =====
  await db.bookIssue.delete({ where: { id: i2.id } });
  await db.bookIssue.delete({ where: { id: i3.id } });
  console.log("cleanup ✓ (kept seed issues + class chat)");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
