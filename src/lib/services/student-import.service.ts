/**
 * B.1 Bulk Student Import — service (Chunk 3).
 *
 * Real parsing, real DB writes. CSV/TSV parsed here (RFC-4180-ish, handles
 * quoted fields); XLSX parsed via exceljs (already a dependency from A.10).
 * Commit creates students through the SAME path as manual registration
 * (atomic admission numbers, guardians, G.9 requirement seeding, audit).
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { nextTenantId } from "@/lib/services/identity.service";
import { normalizeKePhone } from "@/lib/validations/auth";
import type { SessionUser } from "@/lib/core/session";
import {
  HEADER_SYNONYMS,
  MAX_IMPORT_ROWS,
  importedRowSchema,
  type ColumnMapping,
  type ImportField,
  type ImportedRow,
} from "@/lib/validations/student-import";

export class ImportError extends Error {
  constructor(public code: "EMPTY" | "TOO_MANY_ROWS" | "BAD_FILE" | "NO_NAME_MAPPING" | "ABORTED" | "DUPLICATE", message: string) {
    super(message);
    this.name = "ImportError";
  }
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** Detect delimiter: tabs (Google Sheets paste) beat commas beat semicolons. */
export function detectDelimiter(text: string): "\t" | "," | ";" {
  const sample = text.slice(0, 4000);
  const tabs = (sample.match(/\t/g) ?? []).length;
  const commas = (sample.match(/,/g) ?? []).length;
  const semis = (sample.match(/;/g) ?? []).length;
  if (tabs > 0 && tabs >= commas) return "\t";
  if (semis > commas) return ";";
  return ",";
}

/** Parse CSV/TSV text into rows. Handles quotes, "" escapes, CRLF. */
export function parseDelimited(text: string): string[][] {
  const delim = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(cell); cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows.map((r) => r.map((c) => c.trim()));
}

/** Parse an uploaded XLSX buffer (first worksheet) into rows of strings. */
export async function parseXlsx(buf: Buffer): Promise<string[][]> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
  } catch {
    throw new ImportError("BAD_FILE", "That file could not be read as an Excel (.xlsx) workbook.");
  }
  const ws = wb.worksheets[0];
  if (!ws) throw new ImportError("EMPTY", "The workbook has no sheets.");
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (r) => {
    const vals: string[] = [];
    // r.cellCount can lag; use actualCellCount + iterate by column index
    const count = Math.max(r.cellCount, 1);
    for (let c = 1; c <= count; c++) {
      const cell = r.getCell(c);
      let v = "";
      const cv = cell.value as unknown;
      if (cv === null || cv === undefined) v = "";
      else if (cv instanceof Date) v = cv.toISOString().slice(0, 10);
      else if (typeof cv === "object" && cv !== null && "text" in (cv as Record<string, unknown>))
        v = String((cv as { text: unknown }).text ?? "");
      else if (typeof cv === "object" && cv !== null && "result" in (cv as Record<string, unknown>))
        v = String((cv as { result: unknown }).result ?? "");
      else v = String(cv);
      vals.push(v.trim());
    }
    if (vals.some((x) => x !== "")) rows.push(vals);
  });
  return rows;
}

// ---------------------------------------------------------------------------
// Auto column-mapping
// ---------------------------------------------------------------------------

function normHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "");
}

/** Guess which student field each header column holds.
 *  Two passes: EXACT synonym matches first (so "Parent Phone" -> guardianPhone
 *  beats the fuzzy "parent" -> guardianName), then fuzzy contains-matches. */
export function autoMapColumns(headerRow: string[]): ColumnMapping {
  const fields: ImportField[] = headerRow.map(() => "ignore");
  const used = new Set<ImportField>();
  const entries = Object.entries(HEADER_SYNONYMS) as [ImportField, string[]][];

  // pass 1: exact matches
  headerRow.forEach((raw, idx) => {
    const h = normHeader(raw);
    for (const [field, synonyms] of entries) {
      if (used.has(field)) continue;
      if (synonyms.some((s) => normHeader(s) === h)) {
        fields[idx] = field;
        used.add(field);
        break;
      }
    }
  });

  // pass 2: fuzzy contains (only for still-unmapped columns/fields)
  headerRow.forEach((raw, idx) => {
    if (fields[idx] !== "ignore") return;
    const h = normHeader(raw);
    for (const [field, synonyms] of entries) {
      if (used.has(field)) continue;
      if (synonyms.some((s) => h.includes(normHeader(s)) && normHeader(s).length >= 4)) {
        fields[idx] = field;
        used.add(field);
        break;
      }
    }
  });

  return fields.map((field, column) => ({ column, field }));
}

// ---------------------------------------------------------------------------
// Row normalization
// ---------------------------------------------------------------------------

function normGender(v: string): "M" | "F" | null {
  const g = v.trim().toLowerCase();
  if (["m", "male", "boy", "b", "mvulana", "me"].includes(g)) return "M";
  if (["f", "female", "girl", "g", "msichana", "ke"].includes(g)) return "F";
  return null;
}

/** Accepts 14/03/2011, 2011-03-14, 14-03-2011, Excel ISO. Returns YYYY-MM-DD. */
function normDate(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    return `${m[3]}-${mo}-${d}`; // KE convention: day first
  }
  return null;
}

/** "Achieng Mary Otieno" -> {first, middle, last}. */
function splitFullName(v: string): { firstName: string; middleName?: string; lastName: string } | null {
  const parts = v.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  if (parts.length === 2) return { firstName: parts[0], lastName: parts[1] };
  return { firstName: parts[0], middleName: parts.slice(1, -1).join(" "), lastName: parts[parts.length - 1] };
}

export type RowIssue = { row: number; message: string };
export type PreviewRow = ImportedRow & { _row: number; _issues: string[]; _customFields?: { label: string; value: string }[] };

/** Apply a mapping to raw rows -> normalized candidates + per-row issues. */
export function buildCandidates(
  rows: string[][],
  mapping: ColumnMapping,
  hasHeader: boolean
): { candidates: PreviewRow[]; issues: RowIssue[] } {
  const dataRows = hasHeader ? rows.slice(1) : rows;
  if (dataRows.length === 0) throw new ImportError("EMPTY", "No data rows found.");
  if (dataRows.length > MAX_IMPORT_ROWS)
    throw new ImportError("TOO_MANY_ROWS", `Maximum ${MAX_IMPORT_ROWS} students per import (got ${dataRows.length}). Split the file and run again.`);

  const fieldFor = new Map<number, ImportField>();
  for (const m of mapping) if (m.field !== "ignore") fieldFor.set(m.column, m.field);
  const mappedFields = new Set(fieldFor.values());
  const hasNames = mappedFields.has("fullName") || (mappedFields.has("firstName") && mappedFields.has("lastName"));
  if (!hasNames)
    throw new ImportError("NO_NAME_MAPPING", 'Map a "Full name" column, or both "First name" and "Last name".');

  // M.4 — custom columns: each mapped {column, field:"custom", customLabel}
  // is collected separately (a row can have several custom fields at once).
  const customColumns = mapping.filter((m) => m.field === "custom" && m.customLabel);

  const candidates: PreviewRow[] = [];
  const issues: RowIssue[] = [];

  dataRows.forEach((cells, i) => {
    const rowNo = i + (hasHeader ? 2 : 1); // human row number in the sheet
    const rec: Record<string, string> = {};
    fieldFor.forEach((field, col) => {
      if (field === "custom") return; // handled separately below
      const v = (cells[col] ?? "").trim();
      if (v) rec[field] = v;
    });

    const customFields: { label: string; value: string }[] = [];
    for (const cc of customColumns) {
      const v = (cells[cc.column] ?? "").trim();
      if (v) customFields.push({ label: cc.customLabel!, value: v });
    }

    const rowIssues: string[] = [];

    // names
    let firstName = rec.firstName ?? "";
    let middleName = rec.middleName;
    let lastName = rec.lastName ?? "";
    if (rec.fullName && (!firstName || !lastName)) {
      const split = splitFullName(rec.fullName);
      if (split) { firstName = split.firstName; middleName = middleName ?? split.middleName; lastName = split.lastName; }
      else rowIssues.push(`Cannot split name "${rec.fullName}" (needs at least two words).`);
    }

    // gender
    const gender = rec.gender ? normGender(rec.gender) : null;
    if (rec.gender && !gender) rowIssues.push(`Unrecognized gender "${rec.gender}" (use M/F).`);
    if (!rec.gender) rowIssues.push("Missing gender (M/F).");

    // dob
    let dateOfBirth: string | undefined;
    if (rec.dateOfBirth) {
      const d = normDate(rec.dateOfBirth);
      if (d) dateOfBirth = d;
      else rowIssues.push(`Unrecognized date "${rec.dateOfBirth}" (use YYYY-MM-DD or DD/MM/YYYY).`);
    }

    // guardian phone
    let guardianPhone: string | undefined;
    if (rec.guardianPhone) {
      const normalized = normalizeKePhone(rec.guardianPhone);
      if (normalized) guardianPhone = normalized;
      else rowIssues.push(`Invalid Kenyan phone "${rec.guardianPhone}".`);
    }

    const candidate = {
      firstName, middleName, lastName,
      gender: (gender ?? "M") as "M" | "F",
      dateOfBirth,
      className: rec.className,
      legacyAdmissionNo: rec.legacyAdmissionNo ?? rec.admissionNo,
      admissionNo: rec.admissionNo,
      upiNumber: rec.upiNumber,
      birthCertNo: rec.birthCertNo,
      guardianName: rec.guardianName,
      guardianPhone,
      notes: rec.notes,
      openingBalanceKes: rec.openingBalanceKes ? Number(rec.openingBalanceKes) : undefined,
    };

    const parsed = importedRowSchema.safeParse(candidate);
    if (!parsed.success) {
      for (const e of parsed.error.errors) rowIssues.push(e.message);
    }
    if (!gender) {
      // already flagged; row stays invalid
    }
    const ok = parsed.success && gender !== null;
    candidates.push({
      ...(parsed.success ? parsed.data : (candidate as ImportedRow)),
      _row: rowNo,
      _issues: rowIssues,
      _customFields: customFields,
    });
    if (!ok) issues.push({ row: rowNo, message: rowIssues.join(" ") || "Invalid row." });
  });

  return { candidates, issues };
}



/**
 * R.1 — `updateExisting` (default true from the caller) changes what counts
 * as a blocking "duplicate": WITHIN-THE-SAME-FILE collisions are ALWAYS a
 * real problem (two rows can't both become the row that updates one real
 * student without a human picking which), so those are always flagged. But
 * a row that matches an EXISTING DB student is no longer treated as an
 * error here — `commitImport`/`previewImport` instead route it through the
 * real match-and-merge path (`matchExistingStudent`/`diffAgainstExisting`).
 * Passing `updateExisting: false` restores the original strict M.4 behavior
 * (any DB match rejects the whole import) for schools that want it.
 */
async function duplicateIssues(user: SessionUser, candidates: PreviewRow[], updateExisting = true): Promise<RowIssue[]> {
  const issues: RowIssue[] = [];
  const seen = new Map<string, number>();
  function checkInFile(row: PreviewRow, label: string, value?: string | null) {
    const v = (value || "").trim().toLowerCase();
    if (!v) return;
    const key = `${label}:${v}`;
    const first = seen.get(key);
    if (first) {
      issues.push({ row: row._row, message: `Duplicate ${label} in this file (already used on row ${first}).` });
    } else {
      seen.set(key, row._row);
    }
  }
  for (const c of candidates) {
    const anyC = c as PreviewRow & { legacyAdmissionNo?: string; admissionNo?: string };
    checkInFile(c, "school admission number", anyC.legacyAdmissionNo || anyC.admissionNo);
    checkInFile(c, "UPI/NEMIS number", c.upiNumber);
    checkInFile(c, "birth certificate number", c.birthCertNo);
    if (c.dateOfBirth) checkInFile(c, "student identity", `${c.firstName}|${c.lastName}|${c.dateOfBirth}`);
  }

  if (updateExisting) return issues; // DB-level matches are handled by the smart update path, not rejected here

  const legacyNos = candidates.map((c) => ((c as PreviewRow & { legacyAdmissionNo?: string }).legacyAdmissionNo || c.admissionNo || "").trim()).filter(Boolean);
  const upis = candidates.map((c) => c.upiNumber?.trim()).filter(Boolean) as string[];
  const births = candidates.map((c) => c.birthCertNo?.trim()).filter(Boolean) as string[];

  const existing = await tenantDb().student.findMany({
    where: {
      OR: [
        ...(legacyNos.length ? [{ legacyAdmissionNo: { in: legacyNos } }, { admissionNo: { in: legacyNos } }] : []),
        ...(upis.length ? [{ upiNumber: { in: upis } }] : []),
        ...(births.length ? [{ birthCertNo: { in: births } }] : []),
      ],
    },
    select: { admissionNo: true, legacyAdmissionNo: true, upiNumber: true, birthCertNo: true },
  });

  for (const c of candidates) {
    const anyC = c as PreviewRow & { legacyAdmissionNo?: string; admissionNo?: string };
    const legacy = (anyC.legacyAdmissionNo || c.admissionNo || "").trim();
    if (legacy && existing.some((e) => e.legacyAdmissionNo === legacy || e.admissionNo === legacy)) {
      issues.push({ row: c._row, message: `School admission number "${legacy}" already exists.` });
    }
    if (c.upiNumber && existing.some((e) => e.upiNumber === c.upiNumber)) {
      issues.push({ row: c._row, message: `UPI/NEMIS number "${c.upiNumber}" already exists.` });
    }
    if (c.birthCertNo && existing.some((e) => e.birthCertNo === c.birthCertNo)) {
      issues.push({ row: c._row, message: `Birth certificate number "${c.birthCertNo}" already exists.` });
    }
    if (c.dateOfBirth) {
      const nameDup = await tenantDb().student.findFirst({
        where: { firstName: c.firstName, lastName: c.lastName, dateOfBirth: c.dateOfBirth, deletedAt: null },
        select: { id: true },
      });
      if (nameDup) issues.push({ row: c._row, message: `A learner named ${c.firstName} ${c.lastName} with the same date of birth already exists.` });
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// R.1 — Smart create-or-update: match a row against an EXISTING student.
//
// The founder's real complaint: re-importing a register (e.g. adding a
// "Guardian phone" or "Fee balance" column the school didn't have before)
// used to either get the WHOLE import rejected as a duplicate, or — if a
// school worked around that by renaming/tweaking rows — silently create a
// SECOND student record for the same real child. Neither is acceptable.
//
// Real match priority (most certain first), same identifiers the existing
// `duplicateIssues()` already treats as unique-enough to reject on:
//   1. School admission number (legacyAdmissionNo/admissionNo column)
//   2. UPI/NEMIS number
//   3. Birth certificate number
//   4. Same first+last name AND same date of birth
//   5. Same first+last name AND a guardian who shares the SAME phone number
//      already on file for that name — the founder's explicit example of
//      "students with the same name, difference noticed in the parent phone
//      number." This is intentionally the WEAKEST/last-resort match (name
//      collisions are common in Kenyan schools), so it only ever fires when
//      the guardian phone genuinely also matches a real existing guardian
//      already linked to a same-named student.
// ---------------------------------------------------------------------------

export interface ExistingStudentMatch {
  id: string;
  matchedOn: "admissionNo" | "upiNumber" | "birthCertNo" | "name+dob" | "name+guardianPhone";
  firstName: string;
  middleName: string | null;
  lastName: string;
  gender: string;
  dateOfBirth: string | null;
  classId: string | null;
  legacyAdmissionNo: string | null;
  admissionNo: string;
  upiNumber: string | null;
  birthCertNo: string | null;
  notes: string | null;
}

/** Find at most one existing (non-deleted) student this row is really about. */
export async function matchExistingStudent(c: PreviewRow): Promise<ExistingStudentMatch | null> {
  const anyC = c as PreviewRow & { legacyAdmissionNo?: string; admissionNo?: string };
  const legacy = (anyC.legacyAdmissionNo || anyC.admissionNo || "").trim();

  const select = {
    id: true, firstName: true, middleName: true, lastName: true, gender: true,
    dateOfBirth: true, classId: true, legacyAdmissionNo: true, admissionNo: true,
    upiNumber: true, birthCertNo: true, notes: true,
  } as const;

  if (legacy) {
    const byAdm = await tenantDb().student.findFirst({
      where: { deletedAt: null, OR: [{ legacyAdmissionNo: legacy }, { admissionNo: legacy }] },
      select,
    });
    if (byAdm) return { ...byAdm, matchedOn: "admissionNo" };
  }
  if (c.upiNumber) {
    const byUpi = await tenantDb().student.findFirst({ where: { deletedAt: null, upiNumber: c.upiNumber }, select });
    if (byUpi) return { ...byUpi, matchedOn: "upiNumber" };
  }
  if (c.birthCertNo) {
    const byBc = await tenantDb().student.findFirst({ where: { deletedAt: null, birthCertNo: c.birthCertNo }, select });
    if (byBc) return { ...byBc, matchedOn: "birthCertNo" };
  }
  if (c.dateOfBirth) {
    const byDob = await tenantDb().student.findFirst({
      where: { deletedAt: null, firstName: c.firstName, lastName: c.lastName, dateOfBirth: c.dateOfBirth },
      select,
    });
    if (byDob) return { ...byDob, matchedOn: "name+dob" };
  }
  // Last resort: same name AND the row's guardian phone already belongs to
  // a guardian linked to a same-named student — the real signal the founder
  // asked for to disambiguate two students who happen to share a name.
  if (c.guardianPhone) {
    const sameNameStudents = await tenantDb().student.findMany({
      where: { deletedAt: null, firstName: c.firstName, lastName: c.lastName },
      select: { ...select, guardians: { select: { guardian: { select: { phone: true } } } } },
    });
    const byPhone = sameNameStudents.find((s) => s.guardians.some((g) => g.guardian.phone === c.guardianPhone));
    if (byPhone) {
      const { guardians: _guardians, ...rest } = byPhone;
      return { ...rest, matchedOn: "name+guardianPhone" };
    }
  }
  return null;
}

/** A field that differs between the row and the existing record — surfaced
 * to the school for an explicit yes/no before anything is overwritten. */
export interface FieldConflict { field: string; existingValue: string; newValue: string }

/** Compare a row's mapped fields against an existing student. Returns which
 * fields are genuinely NEW (blank on the record, safe to fill for free) vs
 * which are real CONFLICTS (both sides have a value, and they differ). */
export function diffAgainstExisting(c: PreviewRow, existing: ExistingStudentMatch): { fillable: string[]; conflicts: FieldConflict[] } {
  const fillable: string[] = [];
  const conflicts: FieldConflict[] = [];
  function compare(field: string, existingValue: string | null | undefined, newValue: string | undefined) {
    if (!newValue) return; // nothing offered by the row
    if (!existingValue) { fillable.push(field); return; }
    if (existingValue.trim().toLowerCase() !== newValue.trim().toLowerCase()) {
      conflicts.push({ field, existingValue, newValue });
    }
    // identical value on both sides: nothing to do, not a conflict, not "fillable"
  }
  // A matched-by-admissionNo/UPI/birth-cert row whose NAME genuinely differs
  // from the record on file is a real conflict too — e.g. the admission
  // number was reused for a different learner, or a typo in the sheet. Only
  // compared when the match wasn't already made BY name (name+dob /
  // name+guardianPhone matches are name-identical by construction).
  if (existing.matchedOn !== "name+dob" && existing.matchedOn !== "name+guardianPhone") {
    compare("firstName", existing.firstName, c.firstName);
    compare("lastName", existing.lastName, c.lastName);
  }
  compare("middleName", existing.middleName, c.middleName);
  compare("dateOfBirth", existing.dateOfBirth, c.dateOfBirth);
  compare("upiNumber", existing.upiNumber, c.upiNumber);
  compare("birthCertNo", existing.birthCertNo, c.birthCertNo);
  compare("notes", existing.notes, c.notes);
  return { fillable, conflicts };
}

/**
 * R.1 — record an imported "opening balance" as a real, standalone ARREARS
 * invoice — NEVER as an edit to any existing invoice's totals. This directly
 * answers the founder's carry-forward concern: a school importing "this
 * student owes KES 8,000 from last term" gets a real invoice a parent can
 * see and pay, without ever touching money already recorded as paid.
 * Idempotent per (student, amount) via a stable description, so re-running
 * the same import file twice never double-bills a family.
 */
async function reconcileOpeningBalance(user: SessionUser, studentId: string, amountKes: number) {
  const description = `Imported opening balance (${amountKes.toLocaleString("en-KE")})`;
  const existing = await tenantDb().invoice.findFirst({ where: { studentId, description, kind: "ARREARS" } });
  if (existing) return existing; // already recorded by an earlier run of this same import
  const currentTerm = await tenantDb().academicTerm.findFirst({ where: { current: true } });
  const year = currentTerm?.year ?? new Date().getFullYear();
  const term = currentTerm?.term ?? 1;
  const dueDate = currentTerm?.endDate ?? new Date().toISOString().slice(0, 10);
  const invoiceNo = await nextTenantId(user.tenantId, "INVOICE");
  const invoice = await tenantDb().invoice.create({
    data: {
      invoiceNo, studentId, description, totalKes: amountKes, paidKes: 0, discountKes: 0,
      status: "UNPAID", kind: "ARREARS", dueDate, year, term,
    } as never,
  });
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
      action: "finance.opening_balance_imported", entityType: "invoice", entityId: invoice.id,
      metadata: JSON.stringify({ studentId, amountKes }),
    },
  });
  return invoice;
}

// ---------------------------------------------------------------------------
// Preview (tenant-aware: resolves classes + duplicate checks)
// ---------------------------------------------------------------------------

function classKey(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export async function previewImport(
  user: SessionUser,
  rows: string[][],
  hasHeader: boolean,
  mapping?: ColumnMapping,
  targetClassId?: string,
  updateExisting = true
) {
  return withTenant(user.tenantId, async () => {
    if (rows.length === 0) throw new ImportError("EMPTY", "The file has no rows.");
    const header = hasHeader ? rows[0] : rows[0].map((_, i) => `Column ${i + 1}`);
    const finalMapping = mapping && mapping.length > 0 ? mapping : autoMapColumns(rows[0] ?? []);

    const { candidates, issues } = buildCandidates(rows, finalMapping, hasHeader);
    const dupIssues = await duplicateIssues(user, candidates, updateExisting);
    for (const d of dupIssues) {
      const row = candidates.find((c) => c._row === d.row);
      if (row) row._issues.push(d.message);
      issues.push(d);
    }

    // M.4 — single-class-only import: verify the target class up front and
    // skip class resolution/creation entirely; every row lands in this class.
    let targetClass: { id: string; label: string } | null = null;
    if (targetClassId) {
      const cls = await tenantDb().schoolClass.findUnique({ where: { id: targetClassId } });
      if (!cls) throw new ImportError("BAD_FILE", "The chosen class was not found.");
      targetClass = { id: cls.id, label: [cls.level, cls.stream].filter(Boolean).join(" ") };
    }

    // class resolution map (skipped entirely in single-class-only mode)
    const classes = targetClassId ? [] : await tenantDb().schoolClass.findMany({ where: { archived: false } });
    const byKey = new Map<string, { id: string; label: string }>();
    for (const c of classes) {
      const label = [c.level, c.stream].filter(Boolean).join(" ");
      byKey.set(classKey(label), { id: c.id, label });
      byKey.set(classKey(c.level), { id: c.id, label }); // "Form 2" matches single-stream
    }
    const unknownClasses = new Set<string>();
    if (!targetClassId) {
      for (const c of candidates) {
        if (c.className && !byKey.has(classKey(c.className))) unknownClasses.add(c.className);
      }
    }

    // duplicate detection (existing DB + within file)
    const seen = new Set<string>();
    const dupRows: number[] = [];
    for (const c of candidates) {
      const k = `${c.firstName}|${c.lastName}|${c.dateOfBirth ?? ""}`.toLowerCase();
      if (seen.has(k)) dupRows.push(c._row);
      seen.add(k);
    }

    // R.1 — real match-and-merge preview: for every row with no other error,
    // check if it matches an existing student and, if so, what would be
    // filled for free vs what's a genuine conflict needing confirmation.
    const matchedRows: { row: number; matchedOn: ExistingStudentMatch["matchedOn"]; studentId: string; studentLabel: string; fillable: string[]; conflicts: FieldConflict[] }[] = [];
    if (updateExisting) {
      for (const c of candidates) {
        if (c._issues.length > 0) continue;
        const match = await matchExistingStudent(c);
        if (!match) continue;
        const { fillable, conflicts } = diffAgainstExisting(c, match);
        matchedRows.push({
          row: c._row,
          matchedOn: match.matchedOn,
          studentId: match.id,
          studentLabel: `${[match.firstName, match.middleName, match.lastName].filter(Boolean).join(" ")} (${match.admissionNo})`,
          fillable,
          conflicts,
        });
      }
    }
    const possibleExisting = matchedRows.map((m) => m.row);

    const validCount = candidates.filter((c) => c._issues.length === 0).length;
    return {
      header,
      mapping: finalMapping,
      totalRows: candidates.length,
      validRows: validCount,
      invalidRows: candidates.length - validCount,
      sample: candidates.slice(0, 12),
      issues: issues.slice(0, 50),
      unknownClasses: [...unknownClasses], // will be CREATED on commit
      duplicateInFileRows: dupRows,
      possibleExistingRows: possibleExisting,
      matchedRows, // R.1 — real matches this import will UPDATE, not duplicate
      targetClass, // M.4 — set when this preview is scoped to one class only
    };
  });
}

// ---------------------------------------------------------------------------
// Commit
// ---------------------------------------------------------------------------

export async function commitImport(
  user: SessionUser,
  input: {
    source: "csv" | "xlsx" | "paste";
    fileName?: string;
    rows: string[][];
    hasHeader: boolean;
    mapping: ColumnMapping;

    seedRequirements: boolean;
    skipInvalid: boolean;
    targetClassId?: string;
    /** R.1 — see importCommitSchema for the full explanation. */
    updateExisting?: boolean;
    confirmedConflictRows?: number[];
  }
) {
  return withTenant(user.tenantId, async () => {
    const updateExisting = input.updateExisting ?? true;
    const confirmedConflictRows = new Set(input.confirmedConflictRows ?? []);
    const { candidates, issues } = buildCandidates(input.rows, input.mapping, input.hasHeader);
    const dupIssues = await duplicateIssues(user, candidates, updateExisting);
    if (dupIssues.length > 0) {
      throw new ImportError("DUPLICATE", `Import denied: ${dupIssues[0].message}`);
    }
    const invalid = candidates.filter((c) => c._issues.length > 0);
    if (invalid.length > 0 && !input.skipInvalid)
      throw new ImportError("ABORTED", `${invalid.length} row(s) have errors. Fix them or enable "skip invalid rows".`);

    const valid = candidates.filter((c) => c._issues.length === 0);
    if (valid.length === 0) throw new ImportError("EMPTY", "No valid rows to import.");

    // M.4 — single-class-only import: every row goes into this ONE class.
    // No class resolution from the file, no auto-creation, no ambiguity.
    let forcedClassId: string | null = null;
    if (input.targetClassId) {
      const cls = await tenantDb().schoolClass.findUnique({ where: { id: input.targetClassId } });
      if (!cls) throw new ImportError("BAD_FILE", "The chosen class was not found.");
      forcedClassId = cls.id;
    }

    // resolve / create classes (skipped entirely in single-class-only mode)
    const classes = forcedClassId ? [] : await tenantDb().schoolClass.findMany({ where: { archived: false } });
    const byKey = new Map<string, string>();
    for (const c of classes) {
      const label = [c.level, c.stream].filter(Boolean).join(" ");
      byKey.set(classKey(label), c.id);
      byKey.set(classKey(c.level), c.id);
    }
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: user.tenantId }, select: { curriculum: true, joiningRequirements: true } });
    if (!forcedClassId) {
      for (const c of valid) {
        if (!c.className) continue;
        const k = classKey(c.className);
        if (byKey.has(k)) continue;
        // create the class: last word = stream if there are >=2 words and the
        // remainder looks like a level ("Form 2", "Grade 4", "PP1")
        const words = c.className.trim().split(/\s+/);
        let level = c.className.trim();
        let stream: string | null = null;
        if (words.length >= 3 || (words.length === 2 && !/^\d+$/.test(words[1]))) {
          stream = words[words.length - 1];
          level = words.slice(0, -1).join(" ");
        }
        const created = await tenantDb().schoolClass.create({
          data: { level, stream, curriculum: tenant.curriculum ?? "CBC" } as never,
        });
        byKey.set(k, created.id);
        byKey.set(classKey(level), created.id);
      }
    }

    // master joining requirements (G.9)
    let master: { label: string; category: string; quantity?: number; mandatory?: boolean }[] = [];
    try {
      master = tenant.joiningRequirements ? JSON.parse(tenant.joiningRequirements) : [];
    } catch { master = []; }

    let createdCount = 0;
    let updatedCount = 0;
    const failed: RowIssue[] = [...issues];

    for (const c of valid) {
      // R.1 — check for a real existing-student match BEFORE creating a new
      // row, so a re-imported register enriches the SAME real child instead
      // of ever creating a second student for them.
      const match = updateExisting ? await matchExistingStudent(c) : null;

      if (match) {
        try {
          const { fillable, conflicts } = diffAgainstExisting(c, match);
          const unresolvedConflicts = conflicts.filter((cf) => !confirmedConflictRows.has(c._row));
          if (unresolvedConflicts.length > 0) {
            // Never silently overwrite a real value that disagrees with what's
            // already on file — report it back for the school to confirm.
            failed.push({
              row: c._row,
              message: `Matches existing learner ${match.firstName} ${match.lastName} (${match.admissionNo}) but ${unresolvedConflicts.length} field(s) differ (${unresolvedConflicts.map((cf) => cf.field).join(", ")}) — review and re-import with confirmation to overwrite, or fix the sheet.`,
            });
            continue;
          }

          const updateData: Record<string, unknown> = {};
          if (fillable.includes("firstName") || conflicts.some((cf) => cf.field === "firstName")) updateData.firstName = c.firstName;
          if (fillable.includes("lastName") || conflicts.some((cf) => cf.field === "lastName")) updateData.lastName = c.lastName;
          if (fillable.includes("middleName") || conflicts.some((cf) => cf.field === "middleName")) updateData.middleName = c.middleName || null;
          if (fillable.includes("dateOfBirth") || conflicts.some((cf) => cf.field === "dateOfBirth")) updateData.dateOfBirth = c.dateOfBirth || null;
          if (fillable.includes("upiNumber") || conflicts.some((cf) => cf.field === "upiNumber")) updateData.upiNumber = c.upiNumber || null;
          if (fillable.includes("birthCertNo") || conflicts.some((cf) => cf.field === "birthCertNo")) updateData.birthCertNo = c.birthCertNo || null;
          if (fillable.includes("notes") || conflicts.some((cf) => cf.field === "notes")) updateData.notes = c.notes || null;
          // A class can always be safely (re)assigned on update — it's a
          // real, current placement fact, not a disputed historical field.
          if (!forcedClassId && c.className) {
            const clsId = byKey.get(classKey(c.className));
            if (clsId) updateData.classId = clsId;
          } else if (forcedClassId) {
            updateData.classId = forcedClassId;
          }

          if (Object.keys(updateData).length > 0) {
            await tenantDb().student.update({ where: { id: match.id }, data: updateData as never });
          }

          // Add any NEW custom fields (never overwrite an existing one silently —
          // StudentCustomField's own unique [studentId,label] constraint means a
          // repeat label here is a real, explicit correction, which is fine).
          if (c._customFields && c._customFields.length > 0) {
            for (const f of c._customFields) {
              await tenantDb().studentCustomField.upsert({
                where: { studentId_label: { studentId: match.id, label: f.label } },
                create: { studentId: match.id, label: f.label, value: f.value },
                update: { value: f.value },
              } as never);
            }
          }

          // Add a guardian ONLY if this student doesn't already have one
          // with the same phone (never duplicate a guardian link).
          if (c.guardianName && c.guardianPhone) {
            const existingLink = await tenantDb().studentGuardian.findFirst({
              where: { studentId: match.id, guardian: { phone: c.guardianPhone } },
            });
            if (!existingLink) {
              let guardian = await tenantDb().guardian.findFirst({ where: { phone: c.guardianPhone } });
              if (!guardian) guardian = await tenantDb().guardian.create({ data: { fullName: c.guardianName, phone: c.guardianPhone } as never });
              const hasPrimary = await tenantDb().studentGuardian.findFirst({ where: { studentId: match.id, isPrimary: true } });
              await tenantDb().studentGuardian.create({
                data: { studentId: match.id, guardianId: guardian.id, relationship: "Parent", isPrimary: !hasPrimary } as never,
              });
            }
          }

          // R.1 — opening balance: create a real ARREARS invoice for the
          // amount, never edit an existing invoice's totals. Idempotent per
          // import row via a stable description so re-running the same
          // import twice does not double-bill a family.
          if (c.openingBalanceKes && c.openingBalanceKes > 0) {
            await reconcileOpeningBalance(user, match.id, c.openingBalanceKes);
          }

          updatedCount++;
        } catch (e) {
          failed.push({ row: c._row, message: e instanceof Error ? e.message.slice(0, 140) : "Could not update this learner." });
        }
        continue;
      }

      try {
        const admissionNo = await nextTenantId(user.tenantId, "STUDENT");
        const legacyAdmissionNo = c.legacyAdmissionNo || c.admissionNo || null;
        if (legacyAdmissionNo) {
          const dupLegacy = await tenantDb().student.findFirst({ where: { legacyAdmissionNo, deletedAt: null }, select: { id: true } });
          if (dupLegacy) throw new Error(`School admission no "${legacyAdmissionNo}" already exists.`);
        }

        const student = await tenantDb().student.create({
          data: {
            admissionNo,
            legacyAdmissionNo,
            firstName: c.firstName,
            middleName: c.middleName || null,
            lastName: c.lastName,
            gender: c.gender,
            dateOfBirth: c.dateOfBirth || null,
            classId: forcedClassId ?? (c.className ? byKey.get(classKey(c.className)) ?? null : null),
            upiNumber: c.upiNumber || null,
            birthCertNo: c.birthCertNo || null,
            notes: c.notes || null,
          } as never,
        });

        // M.4 — write any school-defined custom fields for this row.
        if (c._customFields && c._customFields.length > 0) {
          await tenantDb().studentCustomField.createMany({
            data: c._customFields.map((f) => ({
              studentId: student.id,
              label: f.label,
              value: f.value,
            })) as never,
          });
        }

        if (c.guardianName && c.guardianPhone) {
          // reuse guardian by phone if already present (siblings!)
          let guardian = await tenantDb().guardian.findFirst({ where: { phone: c.guardianPhone } });
          if (!guardian) {
            guardian = await tenantDb().guardian.create({
              data: { fullName: c.guardianName, phone: c.guardianPhone } as never,
            });
          }
          await tenantDb().studentGuardian.create({
            data: { studentId: student.id, guardianId: guardian.id, relationship: "Parent", isPrimary: true } as never,
          });
        }

        if (input.seedRequirements && master.length > 0) {
          await tenantDb().studentRequirement.createMany({
            data: master.map((m) => ({
              studentId: student.id,
              label: m.label,
              category: m.category,
              quantity: m.quantity ?? null,
              mandatory: m.mandatory ?? true,
              fulfilled: false,
            })) as never,
          });
        }

        // R.1 — opening balance for a brand-new import row too (e.g. a
        // school importing a mid-year transfer-in student with a known
        // carried balance from their old school).
        if (c.openingBalanceKes && c.openingBalanceKes > 0) {
          await reconcileOpeningBalance(user, student.id, c.openingBalanceKes);
        }

        createdCount++;
      } catch (e) {
        const msg = e instanceof Error && e.message.includes("Unique constraint")
          ? `Admission no "${c.admissionNo}" already exists.`
          : e instanceof Error ? e.message.slice(0, 140) : "Unknown error";
        failed.push({ row: c._row, message: msg });
      }
    }

    const importRow = await tenantDb().studentImport.create({
      data: {
        fileName: input.fileName ?? null,
        source: input.source,
        totalRows: candidates.length,
        createdRows: createdCount,
        updatedRows: updatedCount,
        failedRows: failed.length,
        errorRows: failed.length ? JSON.stringify(failed.slice(0, 200)) : null,
        targetClassId: forcedClassId,
        createdById: user.id,
        createdByName: user.fullName,
      } as never,
    });

    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "student.bulk_import",
        entityType: "studentImport",
        entityId: importRow.id,

        metadata: JSON.stringify({ source: input.source, total: candidates.length, created: createdCount, failed: failed.length }),
      },
    });

    return { importId: importRow.id, totalRows: candidates.length, created: createdCount, updated: updatedCount, failed };
  });
}

/** Import history for the UI. */
export async function listImports(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const rows = await tenantDb().studentImport.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
    return rows.map((r) => ({
      id: r.id,
      fileName: r.fileName,
      source: r.source,
      totalRows: r.totalRows,
      createdRows: r.createdRows,
      updatedRows: r.updatedRows,
      failedRows: r.failedRows,
      errorRows: r.errorRows ? (JSON.parse(r.errorRows) as RowIssue[]) : [],
      createdByName: r.createdByName,
      createdAt: r.createdAt,
    }));
  });
}
