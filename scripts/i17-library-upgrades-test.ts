import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import {
  addBook,
  billFineToInvoice,
  findByBarcode,
  issueBook,
  libraryPolicy,
  openIssues,
  returnBook,
  setLibraryPolicy,
  type LibraryError,
} from "@/lib/services/library.service";
import { transferStudent } from "@/lib/services/student.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

function asUser(u: any): SessionUser {
  return {
    id: u.id,
    tenantId: u.tenantId,
    neyoLoginId: u.neyoLoginId,
    fullName: u.fullName,
    phone: u.phone,
    email: u.email,
    role: u.role as Role,
    secondaryRole: u.secondaryRole as Role | null,
    language: u.language ?? "en",
  };
}

async function expectBlocked(fn: () => Promise<unknown>, message: string) {
  try {
    await fn();
  } catch (e) {
    assert(/library|book|fine|clear/i.test((e as Error).message) || Boolean((e as LibraryError).code), message);
    return;
  }
  throw new Error(`Expected block: ${message}`);
}

async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "karibu-high" } });
  const librarian = asUser(await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "library@karibuhigh.ac.ke" } }));
  const principal = asUser(await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "principal@karibuhigh.ac.ke" } }));
  const chebet = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "f.chebet@karibuhigh.ac.ke" } });
  const student = await db.student.findFirstOrThrow({ where: { tenantId: tenant.id, firstName: "Achieng" } });
  const suffix = Date.now().toString().slice(-6);
  const isbn = `I17-${suffix}`;

  const originalPolicy = await libraryPolicy(librarian);
  const book = await addBook(librarian, { title: `I.17 Scanner Book ${suffix}`, author: "NEYO Library", isbn, category: "Reference", shelf: "I17", copiesTotal: 2 });
  const due = new Date(Date.now() + 3 * 3600_000 + 7 * 24 * 3600_000).toISOString().slice(0, 10);

  try {
    const hit = await findByBarcode(librarian, isbn);
    assert(hit.id === book.id && hit.copiesAvailable === 2, "barcode lookup finds a real catalog book by ISBN/scanner code");

    const staffIssue = await issueBook(librarian, { bookId: book.id, staffUserId: chebet.id, dueDate: due });
    assert(staffIssue.borrowerType === "STAFF" && staffIssue.borrowerUserId === chebet.id, "teachers/staff can borrow books using staff borrower path");
    await db.bookIssue.update({ where: { id: staffIssue.id }, data: { fineKes: 50, finePaid: false, returnedAt: new Date() } });
    await expectBlocked(() => billFineToInvoice(librarian, staffIssue.id), "staff fines cannot be billed to student invoices");

    const studentIssue = await issueBook(librarian, { bookId: book.id, studentId: student.id, dueDate: due });
    await expectBlocked(
      () => transferStudent(principal, student.id, { destinationSchool: "Test School", destinationCounty: "Kiambu", transferDate: "2026-06-23", reason: "relocation" }),
      "transfer/clearance blocks students with open library books"
    );
    await returnBook(librarian, { issueId: studentIssue.id, finePaid: true });

    await setLibraryPolicy(librarian, { finesEnabled: true, finePerDayKes: 25 });
    const policy = await libraryPolicy(librarian);
    assert(policy.finesEnabled && policy.finePerDayKes === 25, "late-return fine switch supports a customizable amount");

    const oldDue = "2026-06-10";
    const fineIssue = await issueBook(librarian, { bookId: book.id, studentId: student.id, dueDate: due });
    await db.bookIssue.update({ where: { id: fineIssue.id }, data: { dueDate: oldDue } });
    const open = await openIssues(librarian);
    const fineRow = open.find((i) => i.id === fineIssue.id);
    assert(Boolean(fineRow) && fineRow!.fineSoFarKes % 25 === 0 && fineRow!.fineSoFarKes > 0, "open issues use the customized per-day fine amount");
    await returnBook(librarian, { issueId: fineIssue.id, finePaid: true });

    const client = readFileSync(join(process.cwd(), "src/components/library/library-client.tsx"), "utf8");
    const route = readFileSync(join(process.cwd(), "src/app/api/library/route.ts"), "utf8");
    const service = readFileSync(join(process.cwd(), "src/lib/services/library.service.ts"), "utf8");

    assert(client.includes("Built-in scanner") && client.includes("BarcodeDetector") && client.includes("getUserMedia"), "Library UI has a direct built-in NEYO camera scanner");
    assert(client.includes("External hardware scanner: not connected") && !client.includes("hardware scanner connected"), "Library UI never claims hardware is connected when it is not");
    assert(client.includes("Search Book Catalog") && client.includes("Search Borrower") && !client.includes("<select"), "library transactions are search-only, not dropdown-based");
    assert(route.includes('view === "policy"') && route.includes('action === "finePolicy"'), "library API exposes real fine policy read/write endpoints");
    assert(service.includes("libraryFinePerDayKes") && service.includes("library.fine_policy_updated"), "library service persists customizable fine amount and audits policy changes");

    console.log("\nI.17 Library Upgrades test passed.");
  } finally {
    await setLibraryPolicy(librarian, originalPolicy);
    await db.bookIssue.deleteMany({ where: { tenantId: tenant.id, bookId: book.id } });
    await db.libraryBook.deleteMany({ where: { tenantId: tenant.id, id: book.id } });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => db.$disconnect());
