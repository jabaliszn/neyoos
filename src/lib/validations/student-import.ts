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
};

/** One column mapping decision: spreadsheet column index -> student field. */
export const columnMappingSchema = z.array(
  z.object({
    column: z.number().int().min(0),
    field: z.enum(IMPORT_FIELDS),
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
});
export type ImportedRow = z.infer<typeof importedRowSchema>;
