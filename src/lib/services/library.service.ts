/**
 * B.15 Library — catalog, issue/return with availability tracking,
 * AUTO-CALCULATED overdue fines (KES per school day late), barcode lookup
 * (ISBN scanned by phone), digital library files, and per-student reading
 * history (surfaces on the family portal too).
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { scopeWhere } from "@/lib/services/student.service";
import { nextTenantId } from "@/lib/services/identity.service";
import type { SessionUser } from "@/lib/core/session";

export class LibraryError extends Error {
  constructor(public code: "NOT_FOUND" | "DUPLICATE" | "NO_COPIES" | "ALREADY_RETURNED" | "LIMIT" | "INVALID", message: string) {
    super(message);
    this.name = "LibraryError";
  }
}

/** Fine policy: KES per day overdue (school days incl. Saturdays, excl. Sundays). */
export const FINE_PER_DAY_KES = 10;
/** Max books a student may hold at once. */
export const MAX_OPEN_ISSUES = 3;

async function audit(user: SessionUser, action: string, entityType: string, entityId: string, metadata?: unknown) {
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
      action, entityType, entityId,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

function nairobiToday(): string {
  return new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
}

/** Days overdue (Sundays don't count — church/family day, school shut). */
export function overdueDays(dueDate: string, onDate = nairobiToday()): number {
  if (onDate <= dueDate) return 0;
  let days = 0;
  const d = new Date(`${dueDate}T00:00:00Z`);
  const end = new Date(`${onDate}T00:00:00Z`);
  while (d < end) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0) days++; // skip Sundays
  }
  return days;
}

export function computeFine(dueDate: string, onDate = nairobiToday(), finePerDayKes = FINE_PER_DAY_KES): number {
  return overdueDays(dueDate, onDate) * finePerDayKes;
}

// ---------------------------------------------------------------------------
// Fine policy
// ---------------------------------------------------------------------------

export async function libraryPolicy(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const tenant = await db.tenant.findUniqueOrThrow({
      where: { id: user.tenantId },
      select: { libraryFinesEnabled: true, libraryFinePerDayKes: true },
    });
    return { finesEnabled: tenant.libraryFinesEnabled, finePerDayKes: tenant.libraryFinePerDayKes };
  });
}

export async function setLibraryPolicy(user: SessionUser, input: { finesEnabled: boolean; finePerDayKes: number }) {
  return withTenant(user.tenantId, async () => {
    const amount = Math.max(0, Math.min(500, Math.trunc(input.finePerDayKes)));
    const row = await db.tenant.update({
      where: { id: user.tenantId },
      data: { libraryFinesEnabled: input.finesEnabled, libraryFinePerDayKes: amount },
      select: { libraryFinesEnabled: true, libraryFinePerDayKes: true },
    });
    await audit(user, "library.fine_policy_updated", "tenant", user.tenantId, { finesEnabled: row.libraryFinesEnabled, finePerDayKes: row.libraryFinePerDayKes });
    return { finesEnabled: row.libraryFinesEnabled, finePerDayKes: row.libraryFinePerDayKes };
  });
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export async function listBooks(user: SessionUser, q?: string) {
  return withTenant(user.tenantId, async () => {
    const where: Record<string, unknown> = { archived: false };
    if (q?.trim()) {
      const s = q.trim();
      where.OR = [
        { title: { contains: s } },
        { author: { contains: s } },
        { isbn: { contains: s } },
        { category: { contains: s } },
      ];
    }
    const books = await tenantDb().libraryBook.findMany({
      where, orderBy: { title: "asc" }, take: 200,
      include: { issues: { where: { returnedAt: null }, select: { id: true } } },
    });
    return books.map((b) => ({
      id: b.id, title: b.title, author: b.author, isbn: b.isbn, category: b.category,
      shelf: b.shelf, copiesTotal: b.copiesTotal, copiesOut: b.issues.length,
      copiesAvailable: Math.max(0, b.copiesTotal - b.issues.length),
      fileUrl: b.fileUrl, fileName: b.fileName,
    }));
  });
}

export async function addBook(
  user: SessionUser,
  input: { title: string; author?: string; isbn?: string; category?: string; shelf?: string; copiesTotal: number; fileUrl?: string; fileName?: string }
) {
  return withTenant(user.tenantId, async () => {
    if (input.isbn) {
      const dup = await tenantDb().libraryBook.findFirst({ where: { isbn: input.isbn, archived: false } });
      if (dup) throw new LibraryError("DUPLICATE", `That ISBN/barcode is already in the catalog ("${dup.title}"). Edit its copy count instead.`);
    }
    const book = await db.libraryBook.create({
      data: {
        tenantId: user.tenantId, title: input.title, author: input.author ?? null,
        isbn: input.isbn || null, category: input.category ?? null, shelf: input.shelf ?? null,
        copiesTotal: input.copiesTotal, fileUrl: input.fileUrl ?? null, fileName: input.fileName ?? null,
      },
    });
    await audit(user, "library.book_added", "libraryBook", book.id, { title: input.title, copies: input.copiesTotal });
    return book;
  });
}

/** Barcode lookup: scan/type an ISBN → the book + availability + open issues. */
export async function findByBarcode(user: SessionUser, isbn: string) {
  return withTenant(user.tenantId, async () => {
    const book = await tenantDb().libraryBook.findFirst({
      where: { isbn: isbn.trim(), archived: false },
      include: { issues: { where: { returnedAt: null } } },
    });
    if (!book) throw new LibraryError("NOT_FOUND", "No book with that barcode/ISBN in the catalog.");
    return {
      id: book.id, title: book.title, author: book.author, shelf: book.shelf,
      copiesTotal: book.copiesTotal, copiesOut: book.issues.length,
      copiesAvailable: Math.max(0, book.copiesTotal - book.issues.length),
      openIssues: book.issues.map((i) => ({
        id: i.id, studentName: i.studentName, admissionNo: i.admissionNo,
        dueDate: i.dueDate, fineSoFarKes: computeFine(i.dueDate),
      })),
    };
  });
}

// ---------------------------------------------------------------------------
// Issue / return
// ---------------------------------------------------------------------------

export async function issueBook(
  user: SessionUser,
  input: { bookId: string; studentId?: string; staffUserId?: string; dueDate: string }
) {
  return withTenant(user.tenantId, async () => {
    const book = await tenantDb().libraryBook.findUnique({
      where: { id: input.bookId },
      include: { issues: { where: { returnedAt: null } } },
    });
    if (!book || book.archived) throw new LibraryError("NOT_FOUND", "Book not found.");
    if (book.issues.length >= book.copiesTotal)
      throw new LibraryError("NO_COPIES", `All ${book.copiesTotal} cop${book.copiesTotal === 1 ? "y is" : "ies are"} out. Next return frees one.`);

    if (input.dueDate <= nairobiToday())
      throw new LibraryError("INVALID", "Due date must be in the future.");

    // H.5 Teacher Book Borrowing — STAFF borrower path.
    if (input.staffUserId) {
      const staff = await tenantDb().user.findFirst({ where: { id: input.staffUserId } });
      if (!staff) throw new LibraryError("NOT_FOUND", "Staff member not found.");
      // Families are not "staff borrowers".
      if (staff.role === "PARENT" || staff.role === "STUDENT")
        throw new LibraryError("INVALID", "Only staff members can borrow on a staff ID.");

      const openS = await tenantDb().bookIssue.count({ where: { borrowerUserId: staff.id, returnedAt: null } });
      if (openS >= MAX_OPEN_ISSUES)
        throw new LibraryError("LIMIT", `${staff.fullName} already holds ${openS} books — the limit is ${MAX_OPEN_ISSUES}. Return one first.`);
      const dupeS = await tenantDb().bookIssue.findFirst({ where: { bookId: book.id, borrowerUserId: staff.id, returnedAt: null } });
      if (dupeS) throw new LibraryError("DUPLICATE", "This staff member already has a copy of this book out.");

      // Staff "library ID" = TSC number from their HR profile when present, else NEYO id.
      const profile = await tenantDb().staffProfile.findFirst({ where: { userId: staff.id } });
      const staffLibraryId = profile?.tscNumber ? `TSC ${profile.tscNumber}` : (staff.neyoLoginId ?? "STAFF");

      const issue = await db.bookIssue.create({
        data: {
          tenantId: user.tenantId, bookId: book.id,
          borrowerType: "STAFF", borrowerUserId: staff.id, studentId: null,
          studentName: staff.fullName, admissionNo: staffLibraryId,
          issuedById: user.id, issuedByName: user.fullName, dueDate: input.dueDate,
        },
      });
      await audit(user, "library.issued", "bookIssue", issue.id, { book: book.title, staff: staff.fullName, due: input.dueDate });
      return issue;
    }

    // STUDENT borrower path (default).
    const student = await tenantDb().student.findFirst({
      where: { id: input.studentId, status: "ACTIVE", deletedAt: null },
    });
    if (!student) throw new LibraryError("NOT_FOUND", "Student not found (or not active).");

    const open = await tenantDb().bookIssue.count({ where: { studentId: student.id, returnedAt: null } });
    if (open >= MAX_OPEN_ISSUES)
      throw new LibraryError("LIMIT", `${student.firstName} already holds ${open} books — the limit is ${MAX_OPEN_ISSUES}. Return one first.`);
    const dupe = await tenantDb().bookIssue.findFirst({ where: { bookId: book.id, studentId: student.id, returnedAt: null } });
    if (dupe) throw new LibraryError("DUPLICATE", "This student already has a copy of this book out.");

    const issue = await db.bookIssue.create({
      data: {
        tenantId: user.tenantId, bookId: book.id,
        borrowerType: "STUDENT", studentId: student.id,
        studentName: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" "),
        admissionNo: student.admissionNo,
        issuedById: user.id, issuedByName: user.fullName, dueDate: input.dueDate,
      },
    });
    await audit(user, "library.issued", "bookIssue", issue.id, { book: book.title, student: issue.studentName, due: input.dueDate });
    return issue;
  });
}

/** Return a book — fine auto-computed from days overdue. */
export async function returnBook(user: SessionUser, input: { issueId: string; finePaid?: boolean }) {
  return withTenant(user.tenantId, async () => {
    const issue = await tenantDb().bookIssue.findUnique({ where: { id: input.issueId }, include: { book: true } });
    if (!issue) throw new LibraryError("NOT_FOUND", "Issue record not found.");
    if (issue.returnedAt) throw new LibraryError("ALREADY_RETURNED", "This book was already returned.");

    const tenant = await db.tenant.findUnique({ where: { id: user.tenantId }, select: { libraryFinesEnabled: true, libraryFinePerDayKes: true } });
    const finesEnabled = tenant?.libraryFinesEnabled ?? true;

    const fineKes = finesEnabled ? computeFine(issue.dueDate, nairobiToday(), tenant?.libraryFinePerDayKes ?? FINE_PER_DAY_KES) : 0;
    const row = await tenantDb().bookIssue.update({
      where: { id: issue.id },
      data: { returnedAt: new Date(), fineKes, finePaid: fineKes === 0 ? true : Boolean(input.finePaid) },
    });
    await audit(user, "library.returned", "bookIssue", row.id, {
      book: issue.book.title, student: issue.studentName, fineKes, finePaid: row.finePaid,
    });
    return { id: row.id, fineKes, finePaid: row.finePaid, daysOverdue: overdueDays(issue.dueDate) };
  });
}

export async function markFinePaid(user: SessionUser, issueId: string) {
  return withTenant(user.tenantId, async () => {
    const issue = await tenantDb().bookIssue.findUnique({ where: { id: issueId } });
    if (!issue) throw new LibraryError("NOT_FOUND", "Issue record not found.");
    const row = await tenantDb().bookIssue.update({ where: { id: issueId }, data: { finePaid: true } });
    await audit(user, "library.fine_paid", "bookIssue", issueId, { fineKes: issue.fineKes });
    return row;
  });
}

/**
 * FOUNDER RULE (2026-06-12): every chargeable service lands on the student's
 * invoice. Bill an unpaid library fine onto a B.7 invoice — the family sees
 * it on the portal and can pay via M-Pesa STK; the fine is marked settled
 * here (it now lives in the fee ledger).
 */
export async function billFineToInvoice(user: SessionUser, issueId: string) {
  return withTenant(user.tenantId, async () => {
    const issue = await tenantDb().bookIssue.findUnique({ where: { id: issueId }, include: { book: true } });
    if (!issue) throw new LibraryError("NOT_FOUND", "Issue record not found.");
    if (!issue.returnedAt) throw new LibraryError("INVALID", "Return the book first — the fine is computed at return.");
    if (issue.fineKes <= 0 || issue.finePaid) throw new LibraryError("INVALID", "No unpaid fine on this record.");
    // H.5 — staff borrowers have no fee invoice; their fines are collected as cash.
    if (issue.borrowerType === "STAFF" || !issue.studentId)
      throw new LibraryError("INVALID", "Staff library fines are paid as cash, not billed to an invoice.");

    const now = new Date(Date.now() + 3 * 3600_000);
    const term = await tenantDb().academicTerm.findFirst({ where: { current: true } });
    const invoiceNo = await nextTenantId(user.tenantId, "INVOICE");
    const due = new Date(now.getTime() + 14 * 24 * 3600_000).toISOString().slice(0, 10);
    const invoice = await db.invoice.create({
      data: {
        tenantId: user.tenantId, invoiceNo, studentId: issue.studentId,
        description: `Library fine — "${issue.book.title}" (${issue.fineKes / FINE_PER_DAY_KES} days late)`,
        totalKes: issue.fineKes, dueDate: due, status: "UNPAID",
        year: now.getUTCFullYear(), term: term?.term ?? 1,
      },
    });
    await tenantDb().bookIssue.update({ where: { id: issueId }, data: { finePaid: true } });
    await audit(user, "library.fine_invoiced", "bookIssue", issueId, { invoiceNo, fineKes: issue.fineKes });
    return { invoiceId: invoice.id, invoiceNo, fineKes: issue.fineKes };
  });
}

/** Open issues (the "out now" desk view) + overdue flags + live fines. */
export async function openIssues(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const tenant = await db.tenant.findUnique({ where: { id: user.tenantId }, select: { libraryFinesEnabled: true, libraryFinePerDayKes: true } });
    const finesEnabled = tenant?.libraryFinesEnabled ?? true;

    const rows = await tenantDb().bookIssue.findMany({
      where: { returnedAt: null },
      include: { book: true },
      orderBy: { dueDate: "asc" },
    });
    const today = nairobiToday();
    return rows.map((r) => ({
      id: r.id, bookTitle: r.book.title, isbn: r.book.isbn,
      studentName: r.studentName, admissionNo: r.admissionNo,
      issuedAt: r.issuedAt, dueDate: r.dueDate,
      overdue: r.dueDate < today,
      daysOverdue: overdueDays(r.dueDate),
      fineSoFarKes: finesEnabled ? computeFine(r.dueDate, today, tenant?.libraryFinePerDayKes ?? FINE_PER_DAY_KES) : 0,
    }));
  });
}

/** Unpaid fines ledger. */
export async function unpaidFines(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const rows = await tenantDb().bookIssue.findMany({
      where: { returnedAt: { not: null }, fineKes: { gt: 0 }, finePaid: false },
      include: { book: true },
      orderBy: { returnedAt: "desc" },
    });
    return rows.map((r) => ({
      id: r.id, bookTitle: r.book.title, studentName: r.studentName,
      admissionNo: r.admissionNo, fineKes: r.fineKes, returnedAt: r.returnedAt,
    }));
  });
}

// ---------------------------------------------------------------------------
// Reading history (B.15.6) — also row-scoped for the family portal
// ---------------------------------------------------------------------------

export async function readingHistory(user: SessionUser, studentId: string) {
  return withTenant(user.tenantId, async () => {
    const tenant = await db.tenant.findUnique({ where: { id: user.tenantId }, select: { libraryFinesEnabled: true, libraryFinePerDayKes: true } });
    const finesEnabled = tenant?.libraryFinesEnabled ?? true;

    // Families: scopeWhere restricts to own children; staff with library/student view pass.
    const scope = await scopeWhere(user);
    const student = await tenantDb().student.findFirst({ where: { AND: [{ id: studentId }, scope] } });
    if (!student) throw new LibraryError("NOT_FOUND", "Student not found.");
    const rows = await tenantDb().bookIssue.findMany({
      where: { studentId },
      include: { book: true },
      orderBy: { issuedAt: "desc" },
      take: 50,
    });
    return rows.map((r) => ({
      id: r.id, title: r.book.title, author: r.book.author,
      issuedAt: r.issuedAt, dueDate: r.dueDate, returnedAt: r.returnedAt,
      fineKes: r.fineKes, finePaid: r.finePaid,
      stillOut: r.returnedAt === null,
      fineSoFarKes: r.returnedAt === null 
        ? (finesEnabled ? computeFine(r.dueDate, nairobiToday(), tenant?.libraryFinePerDayKes ?? FINE_PER_DAY_KES) : 0) 
        : r.fineKes,
    }));
  });
}
