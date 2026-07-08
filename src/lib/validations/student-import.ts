/**
 * B.1 Bulk Student Import — validation (Chunk 2).
 *
 * WHO MAY IMPORT: anyone with "student.create" (registrar/bursar/leadership).
 * The API enforces this via requirePermission("student.create").
 *
 * Flow: the client sends RAW text (csv/tsv) or an uploaded XLSX converted to
 * rows server-side -> we auto-map columns -> the client may adjust the
 * mapping -> preview -> commit. Caps keep slow-3G payloads sane.
 */
import { z } from "zod";

/** Hard cap per import run (keeps SQLite/dev + request bodies safe). */
export const MAX_IMPORT_ROWS = 1000;

/** The student fields a spreadsheet column can map to. */
export const IMPORT_FIELDS = [
  "firstName",
  "middleName",
  "lastName",
  "fullName", // convenience: "Achieng Mary Otieno" -> split for the school
  "gender",
  "dateOfBirth",
  "className", // "Form 2 East" / "Grade 4 Blue" -> resolved to SchoolClass
  "legacyAdmissionNo", // school's own existing admission number; NEYO still generates its own ID
  "admissionNo", // backwards-compatible import header; treated as legacyAdmissionNo
  "upiNumber",
  "birthCertNo",
  "guardianName",
  "guardianPhone",
  "notes",
  // R.1 — smart create-or-update: a school can add or fix fee/opening-balance
  // info on a re-import without ever touching totals already paid, since
  // this only ever creates a real ARREARS invoice for the DIFFERENCE (see
  // reconcileOpeningBalance() in the service) — never edits an existing one.
  "openingBalanceKes",
  "custom", // M.4 — school-defined extra field (needs customLabel)
  "ignore", // explicit "skip this column"
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

/** Header synonyms for fuzzy auto-mapping (lowercased, stripped). */
export const HEADER_SYNONYMS: Record<Exclude<ImportField, "ignore">, string[]> = {
  firstName: ["firstname", "first", "fname", "givenname", "jina la kwanza"],
  middleName: ["middlename", "middle", "othername", "othernames", "secondname"],
  lastName: ["lastname", "last", "surname", "familyname", "sname", "jina la mwisho"],
  fullName: ["fullname", "name", "studentname", "pupilname", "names", "student", "learner", "learnername", "majina"],
  gender: ["gender", "sex", "jinsia"],
  dateOfBirth: ["dateofbirth", "dob", "birthdate", "birthday", "tarehe ya kuzaliwa"],
  className: ["class", "classname", "grade", "form", "stream", "classstream", "darasa", "level"],
  legacyAdmissionNo: ["schooladmissionno", "schooladmno", "legacyadmissionno", "legacyadmno", "oldadmno", "oldadmission", "admissionno", "admno", "admissionnumber", "adm", "admission", "regno", "registrationno", "nambari"],
  admissionNo: ["neyoadmissionno", "neyoadmno", "neyoid"],
  upiNumber: ["upi", "upinumber", "upino", "nemisupi", "nemis"],
  birthCertNo: ["birthcertno", "birthcert", "birthcertificate", "birthcertificateno", "bcno"],
  guardianName: ["guardianname", "parentname", "guardian", "parent", "mzazi", "fathername", "mothername", "parentguardian"],
  guardianPhone: ["guardianphone", "parentphone", "phone", "phoneno", "phonenumber", "contact", "mobile", "simu", "telephone", "parentcontact", "guardiancontact"],
  notes: ["notes", "remarks", "comment", "comments", "maelezo"],
  openingBalanceKes: ["openingbalance", "balance", "feebalance", "outstandingbalance", "arrears", "balancebroughtforward", "bbf", "salio"],
  // "custom" is never auto-mapped by header text — a school always chooses it
  // explicitly and types its own label, so no synonym guessing applies here.
  custom: [],
};


/** One column mapping decision: spreadsheet column index -> student field. */
/**
 * M.4 — a column can map to one of the fixed IMPORT_FIELDS, OR to "custom"
 * with a school-provided label (e.g. "House", "Sponsor", "Previous School").
 * Custom values are stored as clean labeled StudentCustomField rows — never
 * mixed into the free-text `notes` field. This stays fully deterministic
 * (the school types the label once at mapping time); it never depends on AI.
 */
export const columnMappingSchema = z.array(
  z.object({
    column: z.number().int().min(0),
    field: z.enum(IMPORT_FIELDS),
    customLabel: z.string().trim().min(1).max(60).optional(),
  }).refine((v) => v.field !== "custom" || Boolean(v.customLabel), {
    message: "A custom field mapping needs a label.",
    path: ["customLabel"],
  })
).max(40);
export type ColumnMapping = z.infer<typeof columnMappingSchema>;

/** Preview request: raw pasted/uploaded text (csv or tsv) OR pre-parsed rows. */
export const importPreviewSchema = z.object({
  source: z.enum(["csv", "xlsx", "paste"]),
  fileName: z.string().trim().max(120).optional(),
  /** Raw text for csv/paste. XLSX uploads go through multipart instead. */
  text: z.string().max(2_000_000).optional(),
  /** Pre-parsed rows (used on commit so we don't re-parse). */
  rows: z.array(z.array(z.string().max(300))).max(MAX_IMPORT_ROWS + 1).optional(),
  hasHeader: z.boolean().default(true),
  mapping: columnMappingSchema.optional(), // omit -> server auto-maps
  /** M.4 — when set, EVERY row in this import goes into this one class only,
   * ignoring any className column and never auto-creating a new class. */
  targetClassId: z.string().trim().min(1).optional(),
  /** R.1 — preview under smart create-or-update rules (see importCommitSchema). */
  updateExisting: z.boolean().default(true),
}).refine((v) => v.text !== undefined || v.rows !== undefined, {
  message: "Provide pasted text or parsed rows.",
});
export type ImportPreviewInput = z.infer<typeof importPreviewSchema>;

/** Commit request = same shape but mapping is required. */
export const importCommitSchema = z.object({
  source: z.enum(["csv", "xlsx", "paste"]),
  fileName: z.string().trim().max(120).optional(),
  rows: z.array(z.array(z.string().max(300))).min(1).max(MAX_IMPORT_ROWS + 1),
  hasHeader: z.boolean().default(true),
  mapping: columnMappingSchema,
  /** Create per-student joining requirements from the G.9 master list. */
  seedRequirements: z.boolean().default(true),
  /** Skip rows that fail validation (true) or abort whole import (false). */
  skipInvalid: z.boolean().default(true),
  /** M.4 — import every row into this ONE class only (isolation mode). */
  targetClassId: z.string().trim().min(1).optional(),
  /**
   * R.1 — "smart import": when a row matches an EXISTING student (by
   * admission no / UPI / birth cert / name+DOB / name+guardian phone), fill
   * in any blank fields on that student and add new info (guardian, custom
   * fields, opening balance) instead of rejecting the whole import as a
   * duplicate. Defaults to true — this is the safer, more useful default
   * for a school re-uploading an updated register; explicitly set false to
   * get the old strict "duplicates are always rejected" behavior.
   */
  updateExisting: z.boolean().default(true),
  /**
   * R.1 — rows the caller has already reviewed and explicitly confirmed
   * should overwrite a field that already had a DIFFERENT value on the
   * existing student (a genuine conflict, e.g. two different birth dates).
   * Without confirmation, a conflicting field is left untouched and
   * reported back for the school to decide — NEYO never silently overwrites
   * real data. Keyed by the row's 1-based sheet row number.
   */
  confirmedConflictRows: z.array(z.number().int().min(1)).max(MAX_IMPORT_ROWS + 1).optional(),
});
export type ImportCommitInput = z.infer<typeof importCommitSchema>;

/** A single normalized student candidate after mapping (pre-DB). */
export const importedRowSchema = z.object({
  firstName: z.string().trim().min(2, "First name too short").max(60),
  middleName: z.string().trim().max(60).optional(),
  lastName: z.string().trim().min(2, "Last name too short").max(60),
  gender: z.enum(["M", "F"]),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").optional(),
  className: z.string().trim().max(60).optional(),
  legacyAdmissionNo: z.string().trim().max(40).optional(),
  admissionNo: z.string().trim().max(30).optional(),
  upiNumber: z.string().trim().max(30).optional(),
  birthCertNo: z.string().trim().max(30).optional(),
  guardianName: z.string().trim().max(80).optional(),
  guardianPhone: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(500).optional(),
  openingBalanceKes: z.coerce.number().int().min(0).max(10_000_000).optional(),
});
export type ImportedRow = z.infer<typeof importedRowSchema>;
